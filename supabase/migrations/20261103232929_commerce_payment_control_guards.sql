-- Prepared locally only. Supabase CLI is unavailable in this environment.
-- Apply and verify separately before allowing configuration writes.
begin;

create or replace function public.guard_commerce_sale_payment_control()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  controls jsonb;
  method text;
  disabled boolean;
begin
  -- Service-role writers pass through authenticated server boundaries which
  -- validate each mixed component, initial installment and store-credit debit.
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then return new; end if;
  select modules->'payment_controls' into controls
    from public.organization_settings where organization_id = new.organization_id;
  if controls is null then return new; end if;
  if jsonb_typeof(controls) <> 'object' then raise exception 'PAYMENT_CONTROLS_UNAVAILABLE'; end if;
  if exists(select 1 from jsonb_each(controls) c where c.key in ('cash','card','transfer','qr','digital_wallet','credit','store_credit') and jsonb_typeof(c.value) <> 'boolean') then
    raise exception 'PAYMENT_CONTROLS_UNAVAILABLE';
  end if;
  method := case lower(trim(coalesce(new.payment_method, '')))
    when 'efectivo' then 'cash' when 'cash' then 'cash'
    when 'tarjeta' then 'card' when 'card' then 'card'
    when 'transferencia' then 'transfer' when 'transfer' then 'transfer' when 'bank_transfer' then 'transfer'
    when 'credit' then 'credit' when 'credito' then 'credit' when 'crédito' then 'credit'
    when 'store_credit' then 'store_credit' when 'saldo_a_favor' then 'store_credit'
    when 'digital_wallet' then 'digital_wallet' when 'wallet' then 'digital_wallet'
    when 'qr' then 'qr' else null end;
  if method is null then
    -- Direct table inserts cannot prove the components of a mixed sale.
    -- With any restriction active, require the guarded server API instead.
    select exists(select 1 from jsonb_each(controls) c where c.key in ('cash','card','transfer','qr','digital_wallet','credit','store_credit') and c.value = 'false'::jsonb) into disabled;
    if disabled then raise exception 'PAYMENT_METHOD_REQUIRES_SERVER'; end if;
  elsif controls->method = 'false'::jsonb or (method = 'qr' and controls->'transfer' = 'false'::jsonb) then
    raise exception 'PAYMENT_METHOD_DISABLED';
  end if;
  return new;
end;
$function$;
revoke all on function public.guard_commerce_sale_payment_control() from public, anon, authenticated;
drop trigger if exists commerce_sale_payment_control on public.sales;
-- INSERT only: never block historical sale confirmation, reconciliation or refunds.
create trigger commerce_sale_payment_control before insert on public.sales
for each row execute function public.guard_commerce_sale_payment_control();

-- Legacy JSON writers may update unrelated preferences after a policy CAS.
-- Preserve the current policy unless the authorized atomic RPC marks this transaction.
create or replace function public.guard_commerce_payment_control_settings()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare previous_policy jsonb;
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role'
     and current_setting('mitiendapy.payment_controls_write', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' then previous_policy := old.modules->'payment_controls'; end if;
  if coalesce(auth.jwt()->>'role', '') <> 'service_role'
     and new.modules->'payment_controls' is distinct from previous_policy
     and not exists(select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = auth.uid() and m.status = 'active' and m.role::text in ('owner','admin')) then
    raise exception 'PAYMENT_CONTROLS_FORBIDDEN';
  end if;
  if tg_op = 'UPDATE' then new.updated_at := greatest(clock_timestamp(), new.updated_at, old.updated_at + interval '1 millisecond'); end if;
  new.modules := coalesce(new.modules, '{}'::jsonb) - 'payment_controls';
  if previous_policy is not null then new.modules := new.modules || jsonb_build_object('payment_controls', previous_policy); end if;
  return new;
end;
$function$;
revoke all on function public.guard_commerce_payment_control_settings() from public, anon, authenticated;
drop trigger if exists commerce_payment_control_settings on public.organization_settings;
create trigger commerce_payment_control_settings before insert or update of modules on public.organization_settings
for each row execute function public.guard_commerce_payment_control_settings();

create or replace function public.guard_subscription_payment_control_settings()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare previous_policy jsonb;
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role'
     and current_setting('mitiendapy.payment_controls_write', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' then previous_policy := old.features->'payment_controls'; end if;
  if coalesce(auth.jwt()->>'role', '') <> 'service_role'
     and new.features->'payment_controls' is distinct from previous_policy
     and not exists(select 1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.user_id = auth.uid() and r.is_active is true and r.role = 'super_admin' and p.status = 'active') then
    raise exception 'PAYMENT_CONTROLS_FORBIDDEN';
  end if;
  if tg_op = 'UPDATE' then new.updated_at := greatest(clock_timestamp(), new.updated_at, old.updated_at + interval '1 millisecond'); end if;
  new.features := coalesce(new.features, '{}'::jsonb) - 'payment_controls';
  if previous_policy is not null then new.features := new.features || jsonb_build_object('payment_controls', previous_policy); end if;
  return new;
end;
$function$;
revoke all on function public.guard_subscription_payment_control_settings() from public, anon, authenticated;
drop trigger if exists subscription_payment_control_settings on public.system_settings;
create trigger subscription_payment_control_settings before insert or update of features on public.system_settings
for each row execute function public.guard_subscription_payment_control_settings();

create or replace function public.update_payment_control_policy(
 p_scope text, p_organization_id uuid, p_method text, p_enabled boolean, p_revision timestamptz, p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare container jsonb; flags jsonb; revision timestamptz; changed_at timestamptz; previous_flag text; keys text[];
begin
  if p_scope not in ('subscriptions','commerce') or p_scope is null or p_enabled is null then raise exception 'PAYMENT_CONTROLS_INVALID'; end if;
  keys := case when p_scope = 'commerce' then array['cash','card','transfer','qr','digital_wallet','credit','store_credit'] else array['pagopar_card','pagopar_qr','stripe','autopay','promo'] end;
  if p_method is null or not (p_method = any(keys)) then raise exception 'PAYMENT_CONTROLS_INVALID'; end if;
  if not exists(select 1 from public.profiles p where p.id = p_actor_id and p.status = 'active')
     or exists(select 1 from public.user_roles r where r.user_id = p_actor_id and r.is_active is false) then raise exception 'PAYMENT_CONTROLS_FORBIDDEN'; end if;
  if p_scope = 'subscriptions' then
    if p_organization_id is not null or not exists(select 1 from public.user_roles r where r.user_id = p_actor_id and r.is_active is true and r.role = 'super_admin') then raise exception 'PAYMENT_CONTROLS_FORBIDDEN'; end if;
    select features, updated_at into container, revision from public.system_settings where id = 'system' for update;
  else
    if p_organization_id is null or not exists(select 1 from public.organization_members m where m.organization_id = p_organization_id and m.user_id = p_actor_id and m.status = 'active' and m.role::text in ('owner','admin')) then raise exception 'PAYMENT_CONTROLS_FORBIDDEN'; end if;
    select modules, updated_at into container, revision from public.organization_settings where organization_id = p_organization_id for update;
  end if;
  if not found then raise exception 'PAYMENT_CONTROLS_NOT_INITIALIZED'; end if;
  if revision is distinct from p_revision then raise exception 'PAYMENT_CONTROLS_CONFLICT'; end if;
  if container is not null and jsonb_typeof(container) <> 'object' then raise exception 'PAYMENT_CONTROLS_INVALID'; end if;
  container := coalesce(container, '{}'::jsonb);
  flags := container->'payment_controls';
  if flags is not null and jsonb_typeof(flags) <> 'object' then raise exception 'PAYMENT_CONTROLS_INVALID'; end if;
  flags := coalesce(flags, '{}'::jsonb);
  if exists(select 1 from jsonb_each(flags) f where not (f.key = any(keys)) or jsonb_typeof(f.value) <> 'boolean') then raise exception 'PAYMENT_CONTROLS_INVALID'; end if;
  container := container || jsonb_build_object('payment_controls', flags || jsonb_build_object(p_method,p_enabled));
  changed_at := greatest(clock_timestamp(), coalesce(revision, '-infinity'::timestamptz) + interval '1 millisecond');
  previous_flag := current_setting('mitiendapy.payment_controls_write', true);
  perform set_config('mitiendapy.payment_controls_write', 'on', true);
  if p_scope = 'subscriptions' then
    update public.system_settings set features = container, updated_at = changed_at, updated_by = p_actor_id where id = 'system';
  else
    update public.organization_settings set modules = container, updated_at = changed_at where organization_id = p_organization_id;
  end if;
  perform set_config('mitiendapy.payment_controls_write', coalesce(previous_flag,''), true);
  return jsonb_build_object('updated_at', changed_at);
end;
$function$;
revoke all on function public.update_payment_control_policy(text,uuid,text,boolean,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.update_payment_control_policy(text,uuid,text,boolean,timestamptz,uuid) to service_role;

create or replace function public.commerce_payment_controls_version()
returns integer language sql immutable set search_path = pg_catalog as $$ select 2 $$;
revoke all on function public.commerce_payment_controls_version() from public, anon, authenticated;
grant execute on function public.commerce_payment_controls_version() to service_role;
commit;
