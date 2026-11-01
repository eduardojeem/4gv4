-- Arreglos de la revisión de planes y pagos.
--
-- 1. Un pago reembolsado (o con contracargo) no se vuelve a aplicar si Pagopar
--    reenvía la notificación de pago: apply_paid_provider_subscription_payment
--    ahora lo trata igual que uno ya pagado.
-- 2. Cupo de productos y servicios del plan controlado en la base. Las
--    políticas RLS de products solo revisan el permiso del miembro, así que un
--    cliente podía insertar o reactivar productos directo contra la API de
--    Supabase salteando el límite que revisa /api/products. El trigger solo
--    actúa sobre los roles del cliente (authenticated/anon); el servidor
--    (service_role) y las funciones del ciclo de baja siguen igual.

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

create or replace function public.plan_resource_limit(p_plan_code text, p_resource text)
returns integer language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_code text := upper(coalesce(nullif(trim(p_plan_code), ''), 'FREE'));
  v_limits jsonb;
begin
  if p_resource = 'products' then
    return public.plan_product_limit(v_code);
  end if;
  select limits into v_limits from public.plans where upper(code) = v_code limit 1;
  if v_limits is not null and v_limits ? p_resource then
    return nullif(v_limits->>p_resource, '')::integer;
  end if;
  -- Mismos valores por defecto que subscription-service.ts.
  return case v_code
    when 'FREE' then 50
    when 'BASIC' then 200
    when 'PRO' then 5000
    else null
  end;
end;
$$;

-- Cuenta y compara con el límite. Corre como dueño para leer la suscripción y
-- los productos de la organización sin depender de RLS.
create or replace function public.assert_product_plan_quota(p_organization_id uuid, p_resource text, p_product_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_status text;
  v_payment_status text;
  v_plan text;
  v_trial_ends timestamptz;
  v_period_ends timestamptz;
  v_limit integer;
  v_used integer;
begin
  select s.status, s.payment_status, s.plan, s.trial_ends_at, s.current_period_ends_at
    into v_status, v_payment_status, v_plan, v_trial_ends, v_period_ends
    from public.subscriptions s
   where s.organization_id = p_organization_id;
  if v_plan is null then
    select o.plan into v_plan from public.organizations o where o.id = p_organization_id;
  end if;

  v_status := lower(coalesce(v_status, ''));
  if v_status in ('suspended', 'cancelled', 'canceled') then
    raise exception 'PLAN_BLOCKED: la suscripción está suspendida.' using errcode = 'P0001';
  end if;

  -- Mismo criterio de vencido que evaluateSubscriptionStatus: rigen los límites Free.
  if v_status in ('past_due', 'expired', 'unpaid')
     or (lower(coalesce(v_payment_status, '')) = 'unpaid'
         and not (v_status = 'active' and v_period_ends is not null and v_period_ends > now()))
     or (v_status = 'active' and v_period_ends is not null and v_period_ends <= now())
     or (v_status = 'trialing' and v_trial_ends is not null and v_trial_ends <= now()) then
    v_plan := 'FREE';
  end if;

  v_limit := public.plan_resource_limit(v_plan, p_resource);
  if v_limit is null then
    return;
  end if;

  -- Serializa altas concurrentes de la misma organización.
  perform pg_advisory_xact_lock(hashtextextended('products_plan_quota:' || p_organization_id::text, 0));

  select count(*) into v_used
    from public.products p
   where p.organization_id = p_organization_id
     and p.id is distinct from p_product_id
     and p.is_active is distinct from false
     and p.archived_by_plan_at is null
     and (coalesce(p.unit_measure, '') = 'servicio') = (p_resource = 'services');

  if v_used + 1 > v_limit then
    raise exception 'PLAN_LIMIT_REACHED: el plan permite % %.', v_limit,
      case p_resource when 'services' then 'servicios' else 'productos' end
      using errcode = 'P0001';
  end if;
end;
$$;

-- Invoker a propósito: current_user es el rol de quien escribe. Dentro de las
-- funciones del ciclo de baja (security definer) es el dueño y no se controla.
create or replace function public.products_enforce_plan_quota()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Solo cuando la fila pasa a ocupar cupo.
  if not (new.is_active is distinct from false and new.archived_by_plan_at is null) then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.is_active is distinct from false
     and old.archived_by_plan_at is null
     and old.organization_id = new.organization_id
     and (coalesce(old.unit_measure, '') = 'servicio') = (coalesce(new.unit_measure, '') = 'servicio') then
    return new;
  end if;

  perform public.assert_product_plan_quota(
    new.organization_id,
    case when coalesce(new.unit_measure, '') = 'servicio' then 'services' else 'products' end,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists products_enforce_plan_quota on public.products;
create trigger products_enforce_plan_quota
  before insert or update of is_active, archived_by_plan_at, unit_measure, organization_id on public.products
  for each row execute function public.products_enforce_plan_quota();

revoke all on function public.plan_resource_limit(text, text) from public, anon, authenticated;
revoke all on function public.assert_product_plan_quota(uuid, text, uuid) from public, anon;
grant execute on function public.plan_resource_limit(text, text) to service_role;
-- El trigger corre con el rol del cliente y necesita poder llamarla.
grant execute on function public.assert_product_plan_quota(uuid, text, uuid) to authenticated, service_role;
