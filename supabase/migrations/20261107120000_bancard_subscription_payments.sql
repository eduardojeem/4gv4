-- Bancard (vPOS 2.0) reemplaza a Pagopar/uPay como pasarela de la suscripción.
--
-- 1. apply_paid_provider_subscription_payment acepta 'bancard' en lugar de
--    'pagopar'. Se elimina el envoltorio apply_paid_subscription_payment, que
--    tenía el proveedor fijo en 'pagopar'.
-- 2. shop_process_id: Bancard exige un entero único por operación. Sale de una
--    secuencia propia (next_bancard_shop_process_id) y se guarda como texto en
--    subscription_payments.external_reference.
-- 3. Débito automático: el identificador numérico del cliente pasa a llamarse
--    bancard_user_id (es el user_id de la API de tarjetas de Bancard). Las
--    tarjetas guardadas en uPay no existen en Bancard: todas las adhesiones
--    quedan sin tarjeta y desactivadas hasta que el comercio cargue una nueva.
-- 4. Controles de medios de pago: pagopar_card pasa a bancard_card y se quita
--    pagopar_qr.
--
-- Los pagos históricos de Pagopar quedan en subscription_payments tal cual
-- (provider = 'pagopar') para no perder el historial.

begin;

CREATE OR REPLACE FUNCTION public.apply_paid_provider_subscription_payment(p_provider text, p_external_reference text, p_provider_payment_id text, p_payment_method text, p_paid_at timestamp with time zone, p_amount numeric DEFAULT NULL::numeric)
 RETURNS TABLE(applied boolean, organization_id uuid, plan_id text, payment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_payment public.subscription_payments%rowtype;
  v_existing_plan text;
  v_existing_period_end timestamptz;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_default_method text;
begin
  if p_provider not in ('bancard', 'stripe', 'manual') then
    raise exception 'Proveedor de pago no soportado: %', p_provider;
  end if;

  if nullif(trim(p_external_reference), '') is null then
    raise exception 'La referencia externa es obligatoria.';
  end if;

  v_default_method := case p_provider when 'stripe' then 'Stripe' when 'manual' then 'Pago manual' else 'Bancard' end;

  select *
    into v_payment
    from public.subscription_payments
   where provider = p_provider
     and external_reference = p_external_reference
   for update;

  if not found then
    raise exception 'Pago de suscripcion no encontrado.';
  end if;

  if v_payment.plan_id is null then
    raise exception 'El pago no tiene un plan destino.';
  end if;

  if p_amount is not null and abs(v_payment.amount - p_amount) > 0.5 then
    raise exception 'El monto notificado no coincide con el pago pendiente.';
  end if;

  if v_payment.status in ('paid', 'refunded') then
    return query
      select false, v_payment.organization_id, v_payment.plan_id, v_payment.id;
    return;
  end if;

  select s.plan, s.current_period_ends_at
    into v_existing_plan, v_existing_period_end
    from public.subscriptions s
   where s.organization_id = v_payment.organization_id;

  v_period_start := case
    when v_existing_plan = v_payment.plan_id
      and v_existing_period_end is not null
      and v_existing_period_end > v_paid_at
    then v_existing_period_end
    else v_paid_at
  end;
  -- Días extra del prorrateo al bajar a un plan pago más barato.
  v_period_end := v_period_start + interval '1 month' + make_interval(days => coalesce(v_payment.proration_extra_days, 0));

  update public.subscription_payments
     set status = 'paid',
         payment_method = coalesce(nullif(trim(p_payment_method), ''), v_default_method),
         provider_payment_id = coalesce(nullif(trim(p_provider_payment_id), ''), provider_payment_id),
         paid_at = v_paid_at
   where id = v_payment.id;

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    provider,
    provider_subscription_id,
    external_reference,
    payment_status,
    last_payment_method,
    started_at,
    current_period_starts_at,
    current_period_ends_at,
    cancel_at_period_end,
    updated_at
  )
  values (
    v_payment.organization_id,
    v_payment.plan_id,
    'active',
    p_provider,
    p_external_reference,
    p_external_reference,
    'paid',
    coalesce(nullif(trim(p_payment_method), ''), v_default_method),
    v_paid_at,
    v_period_start,
    v_period_end,
    false,
    now()
  )
  on conflict on constraint subscriptions_organization_id_key
  do update set
    plan = excluded.plan,
    status = 'active',
    provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id,
    external_reference = excluded.external_reference,
    payment_status = 'paid',
    last_payment_method = excluded.last_payment_method,
    started_at = coalesce(public.subscriptions.started_at, excluded.started_at),
    current_period_starts_at = excluded.current_period_starts_at,
    current_period_ends_at = excluded.current_period_ends_at,
    cancel_at_period_end = false,
    updated_at = now();

  update public.organizations
     set plan = v_payment.plan_id,
         updated_at = now()
   where id = v_payment.organization_id;

  insert into public.tenant_audit_log (
    organization_id,
    action,
    resource,
    resource_id,
    metadata
  )
  values (
    v_payment.organization_id,
    'subscription.payment_confirmed',
    'subscription_payments',
    v_payment.id::text,
    jsonb_build_object(
      'plan', v_payment.plan_id,
      'amount', v_payment.amount,
      'provider', p_provider,
      'external_reference', p_external_reference
    )
  );

  return query
    select true, v_payment.organization_id, v_payment.plan_id, v_payment.id;
end;
$function$
;

revoke all on function public.apply_paid_provider_subscription_payment(text, text, text, text, timestamp with time zone, numeric) from public, anon, authenticated;
grant execute on function public.apply_paid_provider_subscription_payment(text, text, text, text, timestamp with time zone, numeric) to service_role;

drop function if exists public.apply_paid_subscription_payment(text, text, text, timestamp with time zone, numeric);

-- shop_process_id de Bancard -------------------------------------------------

create sequence if not exists public.bancard_shop_process_id_seq
  as bigint start with 100000 increment by 1 no cycle;
revoke all on sequence public.bancard_shop_process_id_seq from public, anon, authenticated;
grant usage, select on sequence public.bancard_shop_process_id_seq to service_role;

create or replace function public.next_bancard_shop_process_id()
returns bigint
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$ select nextval('public.bancard_shop_process_id_seq') $$;
revoke all on function public.next_bancard_shop_process_id() from public, anon, authenticated;
grant execute on function public.next_bancard_shop_process_id() to service_role;

drop index if exists public.idx_subscription_payments_pagopar_reference_unique;
create unique index if not exists idx_subscription_payments_bancard_reference_unique
  on public.subscription_payments (external_reference)
  where provider = 'bancard' and external_reference is not null;

-- Débito automático ---------------------------------------------------------

alter table public.subscription_autopay rename column pagopar_customer_id to bancard_user_id;
alter table public.subscription_autopay drop constraint if exists subscription_autopay_provider_check;
update public.subscription_autopay
   set provider = 'bancard',
       enabled = false,
       card_status = 'none',
       card_brand = null,
       card_masked = null,
       card_type = null,
       card_issuer = null,
       failed_attempts = 0,
       next_attempt_at = null,
       suspended_at = null,
       last_error = null,
       updated_at = now();
alter table public.subscription_autopay alter column provider set default 'bancard';
alter table public.subscription_autopay add constraint subscription_autopay_provider_check check (provider = 'bancard');
comment on column public.subscription_autopay.bancard_user_id is 'user_id numérico con el que Bancard asocia las tarjetas guardadas (API cards).';

-- Controles de medios de pago -----------------------------------------------

create or replace function public.update_payment_control_policy(
 p_scope text, p_organization_id uuid, p_method text, p_enabled boolean, p_revision timestamptz, p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare container jsonb; flags jsonb; revision timestamptz; changed_at timestamptz; previous_flag text; keys text[];
begin
  if p_scope not in ('subscriptions','commerce') or p_scope is null or p_enabled is null then raise exception 'PAYMENT_CONTROLS_INVALID'; end if;
  keys := case when p_scope = 'commerce' then array['cash','card','transfer','qr','digital_wallet','credit','store_credit'] else array['bancard_card','stripe','autopay','promo'] end;
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

-- La política guardada usaba las claves de Pagopar. El trigger que protege
-- payment_controls rechaza cambios fuera de update_payment_control_policy, así
-- que se apaga solo durante esta conversión.
alter table public.system_settings disable trigger subscription_payment_control_settings;
update public.system_settings
   set features = jsonb_set(
         features,
         '{payment_controls}',
         ((features->'payment_controls') - 'pagopar_card'::text - 'pagopar_qr'::text)
           || case
                when (features->'payment_controls') ? 'pagopar_card'
                then jsonb_build_object('bancard_card', (features->'payment_controls')->'pagopar_card')
                else '{}'::jsonb
              end
       )
 where jsonb_typeof(features->'payment_controls') = 'object';
alter table public.system_settings enable trigger subscription_payment_control_settings;

commit;
