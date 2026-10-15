-- Local-only delivery. Apply after review; this migration does not issue payouts.
begin;
alter table public.technician_payments
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists reversal_cash_movement_id uuid references public.cash_movements(id);

-- Do not guess the branch of historical transfers or payments without evidence.
update public.technician_payments p set branch_id = m.branch_id
from public.cash_movements m
where p.branch_id is null and p.cash_movement_id = m.id
  and m.organization_id = p.organization_id and m.branch_id is not null;

create table public.technician_payment_requests (
  organization_id uuid not null references public.organizations(id),
  request_key text not null check (length(request_key) between 8 and 120),
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(organization_id, request_key)
);
alter table public.technician_payment_requests enable row level security;
revoke all on public.technician_payment_requests from public, anon, authenticated;
grant select, insert on public.technician_payment_requests to service_role;
-- All app mutations now use the checked transactional RPCs below.
revoke insert, update, delete on public.technician_payments from anon, authenticated;

create or replace function public.server_mutate_technician_payment(
  p_organization_id uuid, p_branch_id uuid, p_actor_user_id uuid,
  p_technician_id uuid, p_payment_id uuid, p_request_key text, p_action text, p_input jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  payment public.technician_payments%rowtype;
  stored public.technician_payment_requests%rowtype;
  identity jsonb;
  result jsonb;
  movement jsonb;
  session_id uuid;
  actor_is_manager boolean;
  amount numeric;
  method text;
  state text;
  period_start date;
  period_end date;
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  if p_request_key is null or length(p_request_key) not between 8 and 120
    or p_action not in ('create','confirmar','anular','confirmar_recibo') then
    raise exception 'TECHNICIAN_INVALID_REQUEST';
  end if;
  if not exists(select 1 from public.organization_members where organization_id=p_organization_id
    and user_id=p_actor_user_id and status='active')
    or not exists(select 1 from public.organization_members where organization_id=p_organization_id
    and user_id=p_technician_id and status='active') then
    raise exception 'TECHNICIAN_FORBIDDEN';
  end if;
  actor_is_manager := exists(select 1 from public.organization_members where organization_id=p_organization_id
    and user_id=p_actor_user_id and status='active' and role::text in ('owner','admin','manager'))
    and (public.has_org_permission(p_organization_id,'settings.manage')
      or public.has_org_permission(p_organization_id,'finances.payroll.manage'));
  if (p_action <> 'confirmar_recibo' and not actor_is_manager)
    or (p_action='confirmar_recibo' and p_actor_user_id <> p_technician_id) then
    raise exception 'TECHNICIAN_FORBIDDEN';
  end if;
  if p_branch_id is null or not exists(select 1 from public.branches where id=p_branch_id
    and organization_id=p_organization_id and is_active)
    or not public.user_has_branch_access(p_branch_id,p_actor_user_id) then
    raise exception 'TECHNICIAN_FORBIDDEN';
  end if;
  identity:=jsonb_build_object('actor',p_actor_user_id,'branch',p_branch_id,'technician',p_technician_id,
    'payment',p_payment_id,'action',p_action,'input',p_input);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':technician-payment:'||p_request_key,0));
  select * into stored from public.technician_payment_requests
    where organization_id=p_organization_id and request_key=p_request_key;
  if found then
    if stored.request is distinct from identity then raise exception 'TECHNICIAN_IDEMPOTENCY_CONFLICT'; end if;
    return stored.result;
  end if;

  if p_action='create' then
    if jsonb_typeof(p_input->'amount') is distinct from 'number' then raise exception 'TECHNICIAN_INVALID_REQUEST'; end if;
    amount:=(p_input->>'amount')::numeric;
    method:=coalesce(p_input->>'method','efectivo');
    state:=coalesce(p_input->>'status','pagado');
    period_start:=(p_input->>'period_from')::date;
    period_end:=(p_input->>'period_to')::date;
    if amount<=0 or amount>1000000000 or amount<>round(amount,2)
      or method not in ('efectivo','transferencia','otro') or state not in ('pendiente','pagado')
      or period_start is null or period_end is null or period_start>period_end
      or length(coalesce(p_input->>'notes',''))>500
      or coalesce((p_input->>'base_amount')::numeric,0)<0
      or coalesce((p_input->>'commission_amount')::numeric,0)<0
      or coalesce((p_input->>'fixed_amount')::numeric,0)<0 then
      raise exception 'TECHNICIAN_INVALID_REQUEST';
    end if;
    insert into public.technician_payments(organization_id,branch_id,technician_id,period_from,period_to,
      amount,base_amount,commission_amount,fixed_amount,method,status,notes,paid_by,paid_at)
    values(p_organization_id,p_branch_id,p_technician_id,period_start,period_end,amount,
      coalesce((p_input->>'base_amount')::numeric,0),coalesce((p_input->>'commission_amount')::numeric,0),
      coalesce((p_input->>'fixed_amount')::numeric,0),method,state,p_input->>'notes',
      case when state='pagado' then p_actor_user_id end,case when state='pagado' then now() end)
    returning * into payment;
  else
    select * into payment from public.technician_payments where id=p_payment_id
      and organization_id=p_organization_id and technician_id=p_technician_id for update;
    if not found then raise exception 'TECHNICIAN_PAYMENT_NOT_FOUND'; end if;
    if exists(select 1 from public.payroll_entries where organization_id=p_organization_id
      and legacy_source_id=payment.id) then raise exception 'TECHNICIAN_USE_PAYROLL'; end if;
    if payment.branch_id is null then raise exception 'TECHNICIAN_LEGACY_BRANCH_REQUIRED'; end if;
    if payment.branch_id<>p_branch_id then raise exception 'TECHNICIAN_FORBIDDEN'; end if;
    if (p_action='confirmar' and payment.status<>'pendiente')
      or (p_action='anular' and payment.status not in ('pendiente','pagado'))
      or (p_action='confirmar_recibo' and payment.status<>'pagado') then
      raise exception 'TECHNICIAN_INVALID_TRANSITION';
    end if;
  end if;

  if p_action in ('create','confirmar') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':technician-period:'||p_technician_id::text,0));
    if exists(select 1 from public.payroll_entries e join public.payroll_runs r on r.id=e.payroll_run_id
      and r.organization_id=e.organization_id where e.organization_id=p_organization_id
      and e.employee_id=p_technician_id and r.status<>'voided'
      and r.period_from<=payment.period_to and r.period_to>=payment.period_from) then
      raise exception 'TECHNICIAN_USE_PAYROLL';
    end if;
  end if;

  if p_action='anular' and payment.method='efectivo' and payment.status='pagado'
    and not exists(select 1 from public.cash_movements m where m.id=payment.cash_movement_id
      and m.organization_id=p_organization_id and m.branch_id=p_branch_id
      and m.type='cash_out' and m.amount=payment.amount) then
    raise exception 'TECHNICIAN_LEGACY_CASH_REQUIRED';
  end if;
  if payment.method='efectivo' and (
      (p_action='create' and payment.status='pagado') or p_action='confirmar'
      or (p_action='anular' and payment.cash_movement_id is not null)) then
    select c.id into session_id from public.cash_closures c
      where c.organization_id=p_organization_id and c.branch_id=p_branch_id and c.date is null
      order by c.created_at desc,c.id limit 1 for update;
    if session_id is null then raise exception 'TECHNICIAN_CASH_CLOSED'; end if;
    movement:=public.server_record_cash_movement_atomic(p_actor_user_id,p_organization_id,p_branch_id,
      session_id,case when p_action='anular' then 'cash_in' else 'cash_out' end,payment.amount,
      case when p_action='anular' then 'Reversa de pago a técnico ' else 'Pago a técnico ' end||payment.id::text);
    if nullif(movement->>'id','') is null then raise exception 'TECHNICIAN_CASH_FAILED'; end if;
    if p_action='anular' then payment.reversal_cash_movement_id:=(movement->>'id')::uuid;
    else payment.cash_movement_id:=(movement->>'id')::uuid; end if;
  end if;
  -- Historical paid cash with no movement cannot safely invent a refund.
  if p_action='anular' and payment.method='efectivo' and payment.status='pagado'
    and payment.cash_movement_id is null then raise exception 'TECHNICIAN_LEGACY_CASH_REQUIRED'; end if;
  if p_action='confirmar' then
    payment.status:='pagado'; payment.paid_by:=p_actor_user_id; payment.paid_at:=now();
    payment.approved_by:=p_actor_user_id; payment.approved_at:=now();
  elsif p_action='anular' then payment.status:='anulado';
  elsif p_action='confirmar_recibo' then
    payment.status:='confirmado'; payment.confirmed_by:=p_actor_user_id; payment.confirmed_at:=now();
  end if;
  update public.technician_payments set status=payment.status,paid_by=payment.paid_by,paid_at=payment.paid_at,
    approved_by=payment.approved_by,approved_at=payment.approved_at,confirmed_by=payment.confirmed_by,
    confirmed_at=payment.confirmed_at,cash_movement_id=payment.cash_movement_id,
    reversal_cash_movement_id=payment.reversal_cash_movement_id,updated_at=now()
    where id=payment.id returning * into payment;
  result:=to_jsonb(payment);
  insert into public.technician_payment_requests values(p_organization_id,p_request_key,identity,result,now());
  return result;
end;
$$;

create or replace function public.server_create_technician_payment(
  p_organization_id uuid,p_branch_id uuid,p_actor_user_id uuid,p_technician_id uuid,p_request_key text,p_input jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select public.server_mutate_technician_payment($1,$2,$3,$4,null,$5,'create',$6);
$$;
create or replace function public.server_transition_technician_payment(
  p_organization_id uuid,p_branch_id uuid,p_actor_user_id uuid,p_technician_id uuid,p_payment_id uuid,p_request_key text,p_action text
) returns jsonb language sql security invoker set search_path='' as $$
  select public.server_mutate_technician_payment($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb);
$$;
revoke all on function public.server_mutate_technician_payment(uuid,uuid,uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.server_create_technician_payment(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.server_transition_technician_payment(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.server_mutate_technician_payment(uuid,uuid,uuid,uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.server_create_technician_payment(uuid,uuid,uuid,uuid,text,jsonb) to service_role;
grant execute on function public.server_transition_technician_payment(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;

create or replace function public.guard_technician_payroll_overlap()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  employee uuid;
  run uuid;
  organization uuid;
  period_start date;
  period_end date;
begin
  if new.legacy_source_id is not null then return new; end if;
  organization:=new.organization_id;
  if not public.has_org_permission(organization,'finances.payroll.manage') then
    raise exception 'TECHNICIAN_FORBIDDEN';
  end if;
  if tg_table_name='payroll_entries' then
    employee:=new.employee_id; run:=new.payroll_run_id;
  else
    if new.direction='reversal' then return new; end if;
    select e.employee_id,e.payroll_run_id into employee,run from public.payroll_entries e
      where e.id=new.payroll_entry_id and e.organization_id=organization;
  end if;
  if employee is null or run is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(organization::text||':technician-period:'||employee::text,0));
  select period_from,period_to into period_start,period_end from public.payroll_runs
    where id=run and organization_id=organization and status<>'voided';
  if period_start is null then return new; end if;
  if exists(select 1 from public.technician_payments p where p.organization_id=organization
    and p.technician_id=employee and p.status in ('pagado','confirmado')
    and p.period_from<=period_end and p.period_to>=period_start
    and not exists(select 1 from public.payroll_entries mapped where mapped.organization_id=organization
      and mapped.legacy_source_id=p.id)) then
    raise exception 'TECHNICIAN_RECONCILIATION_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_technician_payroll_overlap() from public,anon,authenticated;
create trigger technician_payroll_entry_overlap
  before insert or update of organization_id,employee_id,payroll_run_id on public.payroll_entries
  for each row execute function public.guard_technician_payroll_overlap();
create trigger technician_payroll_payment_overlap
  before insert on public.payroll_payments
  for each row execute function public.guard_technician_payroll_overlap();
commit;
