-- Promociones por visitas, para los rubros que venden servicios.
--
-- «La 10.ª visita gratis» es la promoción clásica de peluquerías, estéticas y
-- talleres: premia la frecuencia, no el monto. El nuevo tipo visit_milestone
-- regala bonus_points cada visit_interval compras del cliente desde que empezó
-- la promoción. Compite con las demás: se aplica una sola por compra, la que
-- más le conviene al cliente.
--
-- De paso se corrige el tope total de las promociones: se sumaba
-- rule.bonus_points (lo configurado, 0 en las de «×2») en lugar de lo
-- otorgado, así que en las de multiplicador el tope nunca se alcanzaba.

alter table public.loyalty_point_rules add column if not exists visit_interval integer;
alter table public.loyalty_point_rules drop constraint if exists loyalty_point_rules_kind;
alter table public.loyalty_point_rules add constraint loyalty_point_rules_kind
  check (kind = any (array['multiplier', 'bonus_per_purchase', 'visit_milestone']));
alter table public.loyalty_point_rules drop constraint if exists loyalty_point_rules_visit_interval;
alter table public.loyalty_point_rules add constraint loyalty_point_rules_visit_interval
  check (kind <> 'visit_milestone' or (visit_interval is not null and visit_interval between 2 and 100 and bonus_points > 0));

CREATE OR REPLACE FUNCTION public.award_loyalty_points_for_sale(p_organization_id uuid, p_customer_id uuid, p_amount numeric, p_sale_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS public.loyalty_ledger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  settings public.loyalty_settings;
  rule public.loyalty_point_rules;
  existing public.loyalty_ledger;
  base_points integer := 0;
  bonus_points integer := 0;
  total_points integer := 0;
  customer_bonus_used integer := 0;
  earned_today integer := 0;
  daily_room integer;
  current_balance integer := 0;
  inserted public.loyalty_ledger;
  key text := p_idempotency_key;
  has_rule boolean := false;
  visit_rule public.loyalty_point_rules;
  visit_number integer := 0;
  visit_bonus boolean := false;
  granted_bonus integer := 0;
begin
  if p_organization_id is null or p_customer_id is null then
    raise exception 'Falta la organización o el cliente.' using errcode = 'invalid_parameter_value';
  end if;

  -- 'pos.sales.create' es el permiso que tiene quien cierra una venta:
  -- cajero, vendedor, encargado, admin y dueño. Con un nombre que
  -- has_org_permission no conozca, solo pasarían dueño y admin y el POS
  -- dejaría de acreditar.
  if not (
    public.has_org_permission(p_organization_id, 'pos.sales.create')
    or public.has_org_permission(p_organization_id, 'repairs.orders.update')
  ) then
    raise exception 'No tenés permiso para acreditar puntos en esta organización.'
      using errcode = 'insufficient_privilege';
  end if;

  if key is null and p_sale_id is not null then
    key := 'sale:' || p_sale_id::text;
  end if;

  -- Idempotencia: si ya se acredito este hecho, se devuelve el asiento previo.
  if key is not null then
    select * into existing
    from public.loyalty_ledger
    where organization_id = p_organization_id
      and idempotency_key = key;

    if found then
      return existing;
    end if;
  end if;

  select * into settings
  from public.loyalty_settings
  where organization_id = p_organization_id;

  if not found or not settings.enabled then
    return null;
  end if;

  -- El cliente tiene que pertenecer a la organizacion.
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.organization_id = p_organization_id
  ) then
    raise exception 'El cliente no pertenece a la organización indicada.' using errcode = 'invalid_parameter_value';
  end if;

  base_points := public.calculate_base_loyalty_points(
    p_amount,
    settings.currency_per_point,
    settings.points_per_unit,
    settings.rounding
  );

  if base_points <= 0 then
    return null;
  end if;

  -- Promocion vigente: se toma la de mayor beneficio y se bloquea la fila para
  -- que dos ventas simultaneas no se pasen del cupo total.
  select * into rule
  from public.loyalty_point_rules r
  where r.organization_id = p_organization_id
    and r.is_active
    and now() >= r.starts_at
    and now() < r.ends_at
    and (r.min_purchase_amount is null or p_amount >= r.min_purchase_amount)
    and r.kind <> 'visit_milestone'
  order by
    case when r.kind = 'multiplier' then base_points * (r.multiplier - 1) else r.bonus_points end desc
  limit 1
  for update;

  has_rule := found;
  if has_rule then
    if rule.kind = 'multiplier' then
      bonus_points := greatest(0, floor(base_points * (rule.multiplier - 1))::integer);
    else
      bonus_points := rule.bonus_points;
    end if;
  end if;

  -- «Cada N visitas, X puntos de regalo»: compite con la promoción de arriba y
  -- gana la que más le conviene al cliente (una sola por compra). La visita se
  -- cuenta desde que empezó la promoción, contando esta compra.
  for visit_rule in
    select * from public.loyalty_point_rules r
    where r.organization_id = p_organization_id
      and r.is_active
      and r.kind = 'visit_milestone'
      and r.visit_interval is not null
      and now() >= r.starts_at
      and now() < r.ends_at
      and (r.min_purchase_amount is null or p_amount >= r.min_purchase_amount)
    for update
  loop
    select count(*) + 1 into visit_number
    from public.loyalty_ledger l
    where l.organization_id = p_organization_id
      and l.customer_id = p_customer_id
      and l.source in ('purchase', 'promotion')
      and l.created_at >= visit_rule.starts_at;

    if visit_number % visit_rule.visit_interval = 0 and visit_rule.bonus_points > bonus_points then
      rule := visit_rule;
      has_rule := true;
      visit_bonus := true;
      bonus_points := visit_rule.bonus_points;
    end if;
  end loop;

  if has_rule then

    -- Tope por cliente dentro de la promocion.
    if rule.max_bonus_points_per_customer is not null then
      select coalesce(sum(points), 0) into customer_bonus_used
      from public.loyalty_ledger
      where rule_id = rule.id and customer_id = p_customer_id and source = 'promotion';

      bonus_points := least(
        bonus_points,
        greatest(0, rule.max_bonus_points_per_customer - customer_bonus_used)
      );
    end if;

    -- Tope total de la promocion.
    if rule.max_bonus_points_total is not null then
      bonus_points := least(
        bonus_points,
        greatest(0, rule.max_bonus_points_total - rule.awarded_bonus_points)
      );
    end if;

    -- Lo otorgado, no lo configurado (en las de «×2» bonus_points vale 0).
    granted_bonus := bonus_points;
    if granted_bonus > 0 then
      update public.loyalty_point_rules
      set awarded_bonus_points = loyalty_point_rules.awarded_bonus_points + granted_bonus
      where id = rule.id;
    end if;
  end if;

  total_points := base_points + bonus_points;

  -- Tope diario de la organizacion: acota el dano de un error de carga.
  if settings.max_points_per_customer_per_day is not null then
    select coalesce(sum(points), 0) into earned_today
    from public.loyalty_ledger
    where customer_id = p_customer_id
      and points > 0
      and created_at >= date_trunc('day', now());

    daily_room := greatest(0, settings.max_points_per_customer_per_day - earned_today);
    total_points := least(total_points, daily_room);
  end if;

  if total_points <= 0 then
    return null;
  end if;

  select coalesce(balance, 0) into current_balance
  from public.loyalty_accounts
  where customer_id = p_customer_id;

  current_balance := coalesce(current_balance, 0);

  insert into public.loyalty_ledger (
    organization_id, customer_id, points, balance_after, source, description,
    sale_id, rule_id, idempotency_key, expires_at, created_by
  )
  values (
    p_organization_id,
    p_customer_id,
    total_points,
    current_balance + total_points,
    case when bonus_points > 0 then 'promotion' else 'purchase' end,
    case
      when bonus_points > 0 and visit_bonus then
        format('Visita %s: %s puntos + %s de regalo (%s)', visit_number, base_points, bonus_points, coalesce(rule.name, 'promoción'))
      when bonus_points > 0 then
        format('Compra: %s puntos base + %s de bonificación (%s)', base_points, bonus_points, coalesce(rule.name, 'promoción'))
      else format('Compra: %s puntos', base_points)
    end,
    p_sale_id,
    case when bonus_points > 0 then rule.id else null end,
    key,
    case
      when settings.points_expiration_months is not null
        then now() + make_interval(months => settings.points_expiration_months)
      else null
    end,
    auth.uid()
  )
  returning * into inserted;

  return inserted;
end;
$function$
;

-- «Canjeados» en la ficha del cliente sumaba cualquier movimiento en contra:
-- también los vencimientos, los descuentos por devolución y los ajustes. Ahora
-- cuenta solo lo que el cliente usó (sorteos y canje por saldo a favor).
create or replace function public.sync_loyalty_account_from_ledger()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  redeemed integer := case when new.points < 0 and new.source in ('raffle_entry', 'redemption') then -new.points else 0 end;
begin
  insert into public.loyalty_accounts (customer_id, organization_id, balance, lifetime_earned, lifetime_redeemed, updated_at)
  values (new.customer_id, new.organization_id, new.balance_after, greatest(new.points, 0), redeemed, now())
  on conflict (customer_id) do update
  set balance = new.balance_after,
      lifetime_earned = public.loyalty_accounts.lifetime_earned + greatest(new.points, 0),
      lifetime_redeemed = public.loyalty_accounts.lifetime_redeemed + redeemed,
      updated_at = now();

  return new;
end;
$function$;
