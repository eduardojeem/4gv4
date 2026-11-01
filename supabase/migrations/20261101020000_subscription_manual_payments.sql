-- Pago manual de la suscripción, registrado por el superadmin (efectivo,
-- depósito u otro medio fuera de Pagopar y de la transferencia con
-- comprobante). Antes la única opción era cambiar el plan a mano: el MRR subía
-- pero no quedaba ningún cobro registrado.
--
-- Se aplica con la misma función que Pagopar y Stripe (mismo cálculo de
-- período y misma auditoría); solo se suma el proveedor 'manual'.

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
  if p_provider not in ('pagopar', 'stripe', 'manual') then
    raise exception 'Proveedor de pago no soportado: %', p_provider;
  end if;

  if nullif(trim(p_external_reference), '') is null then
    raise exception 'La referencia externa es obligatoria.';
  end if;

  v_default_method := case p_provider when 'stripe' then 'Stripe' when 'manual' then 'Pago manual' else 'Pagopar' end;

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

  if v_payment.status = 'paid' then
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
  v_period_end := v_period_start + interval '1 month';

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

create or replace function public.record_manual_subscription_payment(
  p_actor_id uuid,
  p_organization_id uuid,
  p_plan text,
  p_amount numeric,
  p_payment_method text,
  p_reference text,
  p_paid_at timestamptz default now()
)
returns table(applied boolean, organization_id uuid, plan_id text, payment_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_plan text := upper(trim(coalesce(p_plan, '')));
  v_reference text := 'MAN-' || replace(gen_random_uuid()::text, '-', '');
  v_subscription_id uuid;
begin
  if not exists (
    select 1 from public.profiles
     where id = p_actor_id and role::text = 'super_admin' and coalesce(status::text, 'active') = 'active'
  ) then
    raise exception 'MANUAL_PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if v_plan not in ('BASIC', 'PRO', 'ENTERPRISE') then
    raise exception 'MANUAL_PAYMENT_INVALID_PLAN';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'MANUAL_PAYMENT_INVALID_AMOUNT';
  end if;
  if coalesce(p_paid_at, now()) > now() + interval '1 day' then
    raise exception 'MANUAL_PAYMENT_FUTURE_DATE';
  end if;

  select id into v_subscription_id from public.subscriptions where subscriptions.organization_id = p_organization_id;
  if not found then
    raise exception 'MANUAL_PAYMENT_ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.subscription_payments (
    organization_id, subscription_id, plan_id, amount, currency, status,
    payment_method, provider, external_reference, provider_payment_id
  ) values (
    p_organization_id, v_subscription_id, v_plan, p_amount, 'PYG', 'pending',
    coalesce(nullif(trim(p_payment_method), ''), 'Pago manual'), 'manual', v_reference,
    nullif(trim(coalesce(p_reference, '')), '')
  );

  insert into public.tenant_audit_log (organization_id, user_id, action, resource, resource_id, metadata)
  values (p_organization_id, p_actor_id, 'subscription.manual_payment', 'subscription_payments', v_reference,
          jsonb_build_object('plan', v_plan, 'amount', p_amount, 'method', p_payment_method, 'reference', p_reference));

  return query
    select * from public.apply_paid_provider_subscription_payment(
      'manual', v_reference, coalesce(p_reference, ''), p_payment_method, coalesce(p_paid_at, now()), p_amount
    );
end;
$$;

revoke all on function public.record_manual_subscription_payment(uuid, uuid, text, numeric, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_manual_subscription_payment(uuid, uuid, text, numeric, text, text, timestamptz) to service_role;
