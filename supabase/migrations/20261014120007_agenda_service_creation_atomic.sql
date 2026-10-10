begin;

create table public.agenda_service_create_requests (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_key uuid not null,
  input_fingerprint text not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, request_key)
);
alter table public.agenda_service_create_requests enable row level security;
revoke all on public.agenda_service_create_requests from public, anon, authenticated;
grant select, insert on public.agenda_service_create_requests to service_role;

create function public.agenda_service_policy_revision(p_org uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select md5(jsonb_build_object(
    'organization', (select to_jsonb(o) from public.organizations o where o.id=p_org),
    'plans', (select coalesce(jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text),'[]'::jsonb) from public.plans p),
    'commercialPlans', (select coalesce(jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text),'[]'::jsonb) from public.subscription_plans p),
    'subscriptions', (select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.subscriptions s where s.organization_id=p_org),
    'trials', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.organization_module_trials t where t.organization_id=p_org)
  )::text);
$$;

create function public.create_agenda_service(
  p_org uuid, p_actor uuid, p_key uuid, p_input jsonb, p_limit integer, p_policy_revision text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_previous public.agenda_service_create_requests%rowtype;
  v_id uuid;
  v_price numeric;
  v_duration numeric;
begin
  perform public.agenda_assert_actor(p_org,p_actor,true);
  if p_key is null or p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_SERVICE';
  end if;
  if (select count(*) from jsonb_object_keys(p_input)) <> 5
    or exists(select 1 from jsonb_object_keys(p_input) k where k <> all(array['name','price','durationMinutes','catalogVisible','online']))
    or jsonb_typeof(p_input->'name') is distinct from 'string'
    or length(btrim(p_input->>'name')) not between 1 and 120
    or jsonb_typeof(p_input->'price') is distinct from 'number'
    or jsonb_typeof(p_input->'durationMinutes') is distinct from 'number'
    or jsonb_typeof(p_input->'catalogVisible') is distinct from 'boolean'
    or jsonb_typeof(p_input->'online') is distinct from 'boolean' then
    raise exception 'INVALID_SERVICE';
  end if;
  v_price := (p_input->>'price')::numeric;
  v_duration := (p_input->>'durationMinutes')::numeric;
  if v_price < 0 or v_price > 99999999.99 or v_price <> round(v_price,2)
    or v_duration not between 5 and 600 or v_duration <> trunc(v_duration)
    or p_limit < 0 then raise exception 'INVALID_SERVICE'; end if;

  -- Product writers obtain their relation lock before agenda revision triggers.
  -- Keep that order here to avoid an advisory/relation lock inversion.
  lock table public.products in share row exclusive mode;
  perform public.agenda_lock(p_org);
  select * into v_previous from public.agenda_service_create_requests
    where organization_id=p_org and request_key=p_key;
  if found then
    if v_previous.input_fingerprint <> md5(p_input::text) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',v_previous.product_id,'replayed',true);
  end if;

  -- No network work occurs while these short-lived policy locks are held.
  lock table public.organizations, public.plans, public.subscription_plans,
    public.subscriptions, public.organization_module_trials in share row exclusive mode;
  if p_policy_revision is null or public.agenda_service_policy_revision(p_org) <> p_policy_revision then
    raise exception 'SERVICE_POLICY_CHANGED';
  end if;
  if p_limit is not null and (select count(*) from public.products
    where organization_id=p_org and unit_measure='servicio' and archived_by_plan_at is null) >= p_limit then
    raise exception 'SERVICE_LIMIT_REACHED';
  end if;
  v_id := gen_random_uuid();
  insert into public.products(id,organization_id,sku,name,sale_price,purchase_price,
    unit_measure,stock_quantity,min_stock,is_active,visibility)
  values(v_id,p_org,'SRV-'||replace(v_id::text,'-',''),btrim(p_input->>'name'),v_price,0,
    'servicio',0,0,true,case when (p_input->>'catalogVisible')::boolean then 'public' else 'hidden' end);
  insert into public.agenda_services(organization_id,product_id,duration_minutes,buffer_minutes,online)
  values(p_org,v_id,v_duration::integer,0,(p_input->>'online')::boolean);
  insert into public.tenant_audit_log(organization_id,user_id,action,resource,resource_id,metadata)
  values(p_org,p_actor,'agenda.service.created','products',v_id,
    jsonb_build_object('requestKey',p_key,'service',p_input));
  insert into public.agenda_service_create_requests(organization_id,request_key,input_fingerprint,product_id)
  values(p_org,p_key,md5(p_input::text),v_id);
  return jsonb_build_object('id',v_id,'replayed',false);
end;
$$;

revoke all on function public.agenda_service_policy_revision(uuid) from public,anon,authenticated;
revoke all on function public.create_agenda_service(uuid,uuid,uuid,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.agenda_service_policy_revision(uuid) to service_role;
grant execute on function public.create_agenda_service(uuid,uuid,uuid,jsonb,integer,text) to service_role;
grant execute on function public.agenda_assert_actor(uuid,uuid,boolean) to service_role;
grant execute on function public.agenda_lock(uuid) to service_role;

commit;
