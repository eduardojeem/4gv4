-- Reembolsos, contracargos, prorrateo y registro de avisos de la suscripción.
--
-- 1. Reembolso: el superadmin marca un pago cobrado como reembolsado (la plata
--    se devuelve fuera del sistema: panel de Pagopar o banco) y puede quitar el
--    período que ese pago cubría. Un contracargo que llega por el webhook de
--    Pagopar usa la misma función sin actor.
-- 2. Prorrateo al cambiar entre planes pagos: lo que quedaba sin usar del plan
--    anterior se descuenta del cobro (al subir) o se suma como días extra (al
--    bajar). El cálculo lo hace la aplicación al crear el pago; acá se guardan
--    los valores y apply_paid_provider_subscription_payment suma los días.
-- 3. subscription_reminders_sent: un aviso de vencimiento, pago pendiente o
--    baja se manda una sola vez por organización y período.

alter table public.subscription_payments
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by uuid,
  add column if not exists refund_reason text,
  add column if not exists is_chargeback boolean not null default false,
  add column if not exists proration_credit numeric not null default 0 check (proration_credit >= 0),
  add column if not exists proration_extra_days integer not null default 0 check (proration_extra_days between 0 and 366);

create table if not exists public.subscription_reminders_sent (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null,
  period_key text not null,
  sent_at timestamptz not null default now(),
  primary key (organization_id, kind, period_key)
);
alter table public.subscription_reminders_sent enable row level security;
revoke all on public.subscription_reminders_sent from public, anon, authenticated;
grant all on public.subscription_reminders_sent to service_role;

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

create or replace function public.refund_subscription_payment(
  p_actor_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_revoke_access boolean,
  p_chargeback boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment public.subscription_payments%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_revoked boolean := false;
begin
  if p_actor_id is not null and not exists (
    select 1 from public.profiles
     where id = p_actor_id and role::text = 'super_admin' and coalesce(status::text, 'active') = 'active'
  ) then
    raise exception 'REFUND_FORBIDDEN' using errcode = '42501';
  end if;
  if p_actor_id is null and not p_chargeback then
    raise exception 'REFUND_FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'REFUND_REASON_REQUIRED';
  end if;

  select * into v_payment from public.subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'REFUND_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status = 'refunded' then return to_jsonb(v_payment) || jsonb_build_object('access_revoked', false); end if;
  if v_payment.status <> 'paid' then raise exception 'REFUND_INVALID_STATE'; end if;

  update public.subscription_payments
     set status = 'refunded',
         refunded_at = now(),
         refunded_by = p_actor_id,
         refund_reason = trim(p_reason),
         is_chargeback = coalesce(p_chargeback, false)
   where id = p_payment_id
   returning * into v_payment;

  -- Solo se quita el período si este pago es el que lo cubre (el último aplicado).
  if p_revoke_access then
    select * into v_subscription from public.subscriptions
     where organization_id = v_payment.organization_id for update;
    if found and v_subscription.external_reference is not distinct from v_payment.external_reference
       and coalesce(v_subscription.plan, 'FREE') <> 'FREE' then
      update public.subscriptions
         set status = 'past_due',
             payment_status = 'unpaid',
             current_period_ends_at = least(coalesce(current_period_ends_at, now()), now()),
             cancel_at_period_end = false,
             updated_at = now()
       where id = v_subscription.id;
      v_revoked := true;
    end if;
  end if;

  insert into public.tenant_audit_log (organization_id, user_id, action, resource, resource_id, metadata)
  values (v_payment.organization_id, p_actor_id,
          case when p_chargeback then 'subscription.payment_chargeback' else 'subscription.payment_refunded' end,
          'subscription_payments', v_payment.id::text,
          jsonb_build_object('amount', v_payment.amount, 'reason', trim(p_reason), 'access_revoked', v_revoked));

  return to_jsonb(v_payment) || jsonb_build_object('access_revoked', v_revoked);
end;
$$;

revoke all on function public.refund_subscription_payment(uuid, uuid, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.refund_subscription_payment(uuid, uuid, text, boolean, boolean) to service_role;
