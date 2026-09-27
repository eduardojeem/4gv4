-- Apply a confirmed Pagopar payment exactly once and synchronize plan state.

create unique index if not exists idx_subscription_payments_pagopar_reference_unique
  on public.subscription_payments(external_reference)
  where provider = 'pagopar' and external_reference is not null;

create or replace function public.apply_paid_subscription_payment(
  p_external_reference text,
  p_provider_payment_id text,
  p_payment_method text,
  p_paid_at timestamptz,
  p_amount numeric default null
)
returns table (
  applied boolean,
  organization_id uuid,
  plan_id text,
  payment_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.subscription_payments%rowtype;
  v_existing_plan text;
  v_existing_period_end timestamptz;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if nullif(trim(p_external_reference), '') is null then
    raise exception 'La referencia externa es obligatoria.';
  end if;

  select *
    into v_payment
    from public.subscription_payments
   where provider = 'pagopar'
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
         payment_method = coalesce(nullif(trim(p_payment_method), ''), 'Pagopar'),
         provider_payment_id = nullif(trim(p_provider_payment_id), ''),
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
    'pagopar',
    p_external_reference,
    p_external_reference,
    'paid',
    coalesce(nullif(trim(p_payment_method), ''), 'Pagopar'),
    v_paid_at,
    v_period_start,
    v_period_end,
    false,
    now()
  )
  on conflict (organization_id)
  do update set
    plan = excluded.plan,
    status = 'active',
    provider = 'pagopar',
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
      'provider', 'pagopar',
      'external_reference', p_external_reference
    )
  );

  return query
    select true, v_payment.organization_id, v_payment.plan_id, v_payment.id;
end;
$$;

revoke all on function public.apply_paid_subscription_payment(text, text, text, timestamptz, numeric) from public;
grant execute on function public.apply_paid_subscription_payment(text, text, text, timestamptz, numeric) to service_role;

comment on function public.apply_paid_subscription_payment is
  'Idempotently confirms one Pagopar payment and activates its target plan in a single transaction.';

create or replace function public.apply_free_subscription_plan(
  p_organization_id uuid,
  p_plan text default 'FREE'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_plan <> 'FREE' then
    raise exception 'Solo el plan gratuito puede aplicarse sin confirmacion de pago.';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    return false;
  end if;

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    payment_status,
    cancel_at_period_end,
    current_period_starts_at,
    current_period_ends_at,
    updated_at
  )
  values (
    p_organization_id,
    p_plan,
    'active',
    'manual',
    false,
    null,
    null,
    now()
  )
  on conflict (organization_id)
  do update set
    plan = excluded.plan,
    status = 'active',
    payment_status = 'manual',
    cancel_at_period_end = false,
    current_period_starts_at = null,
    current_period_ends_at = null,
    updated_at = now();

  update public.organizations
     set plan = p_plan,
         updated_at = now()
   where id = p_organization_id;

  return true;
end;
$$;

revoke all on function public.apply_free_subscription_plan(uuid, text) from public;
grant execute on function public.apply_free_subscription_plan(uuid, text) to service_role;
