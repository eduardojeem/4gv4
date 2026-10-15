begin;
create table public.technician_compensation_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  technician_id uuid not null references auth.users(id),
  effective_from date not null,
  config jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(organization_id,technician_id,effective_from)
);
alter table public.technician_compensation_versions enable row level security;
revoke all on public.technician_compensation_versions from public,anon,authenticated;
grant select,insert on public.technician_compensation_versions to service_role;
revoke insert,update,delete on public.technician_compensation from anon,authenticated;
-- Captured legacy conditions are not a reconstruction of missing historical rules.
insert into public.technician_compensation_versions(organization_id,technician_id,effective_from,config)
select organization_id,technician_id,date '1900-01-01',jsonb_build_object(
  'base_salary',base_salary,'commission_rate',commission_rate,'commission_base',commission_base,
  'fixed_per_repair',fixed_per_repair,'accrual_status',accrual_status,'salary_effective_from',salary_effective_from)
from public.technician_compensation;

create or replace function public.server_save_technician_compensation(
  p_organization_id uuid,p_actor_user_id uuid,p_technician_id uuid,p_request_key text,p_input jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  stored public.technician_payment_requests%rowtype;
  current_config public.technician_compensation%rowtype;
  version_id uuid;
  last_date date;
  effective_date date;
  organization_today date;
  identity jsonb;
  config jsonb;
  result jsonb;
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  if not exists(select 1 from public.organization_members where organization_id=p_organization_id
      and user_id=p_actor_user_id and status='active' and role::text in ('owner','admin','manager'))
    or not (public.has_org_permission(p_organization_id,'settings.manage')
      or public.has_org_permission(p_organization_id,'finances.payroll.manage'))
    or not exists(select 1 from public.organization_members where organization_id=p_organization_id
      and user_id=p_technician_id and status='active') then raise exception 'TECHNICIAN_FORBIDDEN'; end if;
  if p_request_key is null or length(p_request_key) not between 8 and 120 then raise exception 'TECHNICIAN_INVALID_REQUEST'; end if;
  identity:=jsonb_build_object('actor',p_actor_user_id,'technician',p_technician_id,'action','compensation','input',p_input);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':technician-payment:'||p_request_key,0));
  select * into stored from public.technician_payment_requests where organization_id=p_organization_id and request_key=p_request_key;
  if found then
    if stored.request is distinct from identity then raise exception 'TECHNICIAN_IDEMPOTENCY_CONFLICT'; end if;
    return stored.result;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':technician-config:'||p_technician_id::text,0));
  organization_today:=public.payroll_organization_date(p_organization_id,now());
  effective_date:=coalesce(nullif(p_input->>'effective_from','')::date,organization_today);
  if effective_date<organization_today or jsonb_typeof(p_input->'base_salary') is distinct from 'number'
    or jsonb_typeof(p_input->'commission_rate') is distinct from 'number'
    or jsonb_typeof(p_input->'fixed_per_repair') is distinct from 'number'
    or (p_input->>'base_salary')::numeric not between 0 and 1000000000
    or (p_input->>'commission_rate')::numeric not between 0 and 100
    or (p_input->>'fixed_per_repair')::numeric not between 0 and 1000000000
    or coalesce(p_input->>'commission_base','') not in ('labor','final')
    or coalesce(p_input->>'accrual_status','') not in ('listo','entregado')
    or nullif(p_input->>'salary_effective_from','')::date>effective_date then
    raise exception 'TECHNICIAN_INVALID_REQUEST';
  end if;
  select max(effective_from) into last_date from public.technician_compensation_versions
    where organization_id=p_organization_id and technician_id=p_technician_id;
  if last_date is not null and effective_date<=last_date then raise exception 'TECHNICIAN_VERSION_DATE_CONFLICT'; end if;
  insert into public.technician_compensation(organization_id,technician_id)
    values(p_organization_id,p_technician_id) on conflict(organization_id,technician_id) do nothing;
  select * into current_config from public.technician_compensation
    where organization_id=p_organization_id and technician_id=p_technician_id for update;
  -- Manual Finance rules belong to their operator. Never guess which to overwrite.
  if exists(select 1 from public.employee_compensation e where e.organization_id=p_organization_id
    and e.employee_id=p_technician_id and (e.effective_to is null or e.effective_to>=effective_date)
    and (e.legacy_source_id is null or (e.legacy_source_id<>current_config.id and not exists(
      select 1 from public.technician_compensation_versions v where v.id=e.legacy_source_id
        and v.organization_id=p_organization_id and v.technician_id=p_technician_id))))
    or exists(select 1 from public.commission_rules r where r.organization_id=p_organization_id
    and r.employee_id=p_technician_id and r.source_type in ('repair','repair_labor') and r.status='approved'
    and (r.effective_to is null or r.effective_to>=effective_date)
    and (r.legacy_source_id is null or (r.legacy_source_id<>current_config.id and not exists(
      select 1 from public.technician_compensation_versions v where v.id=r.legacy_source_id
        and v.organization_id=p_organization_id and v.technician_id=p_technician_id)))) then
    raise exception 'TECHNICIAN_FINANCE_CONFIG_CONFLICT';
  end if;
  if effective_date<=organization_today and exists(select 1 from public.commission_rules r
    where r.organization_id=p_organization_id and r.employee_id=p_technician_id
      and r.source_type in ('repair','repair_labor') and r.status='approved'
      and (r.effective_to is null or r.effective_to>=effective_date)) then
    raise exception 'TECHNICIAN_FUTURE_DATE_REQUIRED';
  end if;
  config:=jsonb_build_object('base_salary',(p_input->>'base_salary')::numeric,
    'commission_rate',(p_input->>'commission_rate')::numeric,'commission_base',p_input->>'commission_base',
    'fixed_per_repair',(p_input->>'fixed_per_repair')::numeric,'accrual_status',p_input->>'accrual_status',
    'salary_effective_from',nullif(p_input->>'salary_effective_from','')::date);
  update public.employee_compensation e set effective_to=effective_date-1,updated_at=now()
    where e.organization_id=p_organization_id and e.employee_id=p_technician_id
    and (e.effective_to is null or e.effective_to>=effective_date)
    and (e.legacy_source_id=current_config.id or exists(select 1 from public.technician_compensation_versions v
      where v.id=e.legacy_source_id and v.organization_id=p_organization_id and v.technician_id=p_technician_id));
  update public.commission_rules r set effective_to=effective_date-1,updated_at=now()
    where r.organization_id=p_organization_id and r.employee_id=p_technician_id
    and (r.effective_to is null or r.effective_to>=effective_date)
    and (r.legacy_source_id=current_config.id or exists(select 1 from public.technician_compensation_versions v
      where v.id=r.legacy_source_id and v.organization_id=p_organization_id and v.technician_id=p_technician_id));
  insert into public.technician_compensation_versions(organization_id,technician_id,effective_from,config,created_by)
    values(p_organization_id,p_technician_id,effective_date,config,p_actor_user_id) returning id into version_id;
  insert into public.employee_compensation(organization_id,employee_id,base_salary,effective_from,
    legacy_source_id,legacy_cutover_on,created_by) values(p_organization_id,p_technician_id,
    (config->>'base_salary')::numeric,effective_date,version_id,effective_date,p_actor_user_id);
  insert into public.commission_rules(organization_id,scope_type,employee_id,source_type,accrual_status,
    calculation_type,value,status,effective_from,legacy_source_id,legacy_component,legacy_cutover_on,
    approved_by,approved_at,created_by)
  select p_organization_id,'employee',p_technician_id,
    case when config->>'commission_base'='labor' then 'repair_labor' else 'repair' end,
    config->>'accrual_status',component,
    case when component='percentage' then (config->>'commission_rate')::numeric else (config->>'fixed_per_repair')::numeric end,
    'approved',effective_date,version_id,component,effective_date,p_actor_user_id,now(),p_actor_user_id
  from (values('percentage'::text),('fixed'::text)) components(component);
  if effective_date=organization_today then
    update public.technician_compensation set base_salary=(config->>'base_salary')::numeric,
      commission_rate=(config->>'commission_rate')::numeric,commission_base=config->>'commission_base',
      fixed_per_repair=(config->>'fixed_per_repair')::numeric,accrual_status=config->>'accrual_status',
      salary_effective_from=nullif(config->>'salary_effective_from','')::date,updated_at=now()
    where id=current_config.id;
  end if;
  result:=jsonb_build_object('compensation',config,'effective_from',effective_date);
  insert into public.technician_payment_requests values(p_organization_id,p_request_key,identity,result,now());
  return result;
end;
$$;
revoke all on function public.server_save_technician_compensation(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.server_save_technician_compensation(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
