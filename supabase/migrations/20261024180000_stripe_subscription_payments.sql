-- Stripe como segundo proveedor de cobro de la suscripción, junto a Pagopar.
-- apply_paid_subscription_payment tenía el proveedor fijo en 'pagopar'; la
-- lógica pasa a apply_paid_provider_subscription_payment y la función vieja
-- queda como envoltorio con la misma firma para el webhook de Pagopar.

create unique index if not exists idx_subscription_payments_stripe_reference_unique
  on public.subscription_payments(external_reference)
  where provider = 'stripe' and external_reference is not null;

create or replace function public.apply_paid_provider_subscription_payment(
  p_provider text,
  p_external_reference text,
  p_provider_payment_id text,
  p_payment_method text,
  p_paid_at timestamp with time zone,
  p_amount numeric default null::numeric
)
 returns table(applied boolean, organization_id uuid, plan_id text, payment_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_payment public.subscription_payments%rowtype;
  v_existing_plan text;
  v_existing_period_end timestamptz;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_default_method text;
begin
  if p_provider not in ('pagopar', 'stripe') then
    raise exception 'Proveedor de pago no soportado: %', p_provider;
  end if;

  if nullif(trim(p_external_reference), '') is null then
    raise exception 'La referencia externa es obligatoria.';
  end if;

  v_default_method := case p_provider when 'stripe' then 'Stripe' else 'Pagopar' end;

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
$function$;

create or replace function public.apply_paid_subscription_payment(
  p_external_reference text,
  p_provider_payment_id text,
  p_payment_method text,
  p_paid_at timestamp with time zone,
  p_amount numeric default null::numeric
)
 returns table(applied boolean, organization_id uuid, plan_id text, payment_id uuid)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select *
    from public.apply_paid_provider_subscription_payment(
      'pagopar',
      p_external_reference,
      p_provider_payment_id,
      p_payment_method,
      p_paid_at,
      p_amount
    );
$function$;

revoke all on function public.apply_paid_provider_subscription_payment(text, text, text, text, timestamp with time zone, numeric) from public, anon, authenticated;
grant execute on function public.apply_paid_provider_subscription_payment(text, text, text, text, timestamp with time zone, numeric) to service_role;
