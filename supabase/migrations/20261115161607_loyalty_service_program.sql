-- Prospectivo: no altera saldos, no activa programas y no reconstruye visitas históricas.
begin;
alter table public.loyalty_settings add column if not exists earning_mode text not null default 'amount'
  check (earning_mode in ('amount', 'visits', 'both'));
alter table public.loyalty_settings add column if not exists service_visits_started_at timestamptz not null default now();
alter table public.loyalty_settings add column if not exists points_per_visit integer not null default 1
  check (points_per_visit between 1 and 100000);
create table if not exists public.loyalty_service_visits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  refunded_amount numeric not null default 0 check (refunded_amount >= 0),
  created_at timestamptz not null default now(),
  primary key (organization_id, appointment_id),
  unique (organization_id, sale_id)
);
create index if not exists loyalty_service_visits_customer on public.loyalty_service_visits (organization_id, customer_id, created_at);
alter table public.loyalty_service_visits enable row level security;
-- Acceso únicamente por funciones con validación explícita; sin escrituras de clientes.
revoke all on public.loyalty_service_visits from anon, authenticated;
grant all on public.loyalty_service_visits to service_role;
create or replace function public.loyalty_service_program_version() returns integer
language sql stable set search_path = pg_catalog as $$ select 1 $$;
revoke all on function public.loyalty_service_program_version() from public, anon;
grant execute on function public.loyalty_service_program_version() to authenticated, service_role;
-- Privado: solo se usa dentro de las funciones que ya validaron organización y permisos.
create or replace function public.loyalty_sale_fully_paid(p_org uuid, p_sale uuid) returns boolean
language sql stable set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.sales s where s.id = p_sale and s.organization_id = p_org
      and s.status in ('completed', 'completada') and s.total_amount > 0
      and (s.payment_status in ('completed', 'paid') or exists (
        select 1 from public.customer_credits c where c.organization_id = p_org and c.sale_id = p_sale and c.status = 'completed'
      ))
      and not exists (select 1 from public.customer_credits c
        where c.organization_id = p_org and c.sale_id = p_sale and c.status <> 'completed')
  )
$$;
revoke all on function public.loyalty_sale_fully_paid(uuid,uuid) from public, anon, authenticated;
create table if not exists public.loyalty_service_milestones (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rule_id uuid not null references public.loyalty_point_rules(id) on delete cascade,
  cycle integer not null check(cycle > 0),
  primary key (organization_id, customer_id, rule_id, cycle)
);
alter table public.loyalty_service_milestones enable row level security;
revoke all on public.loyalty_service_milestones from anon, authenticated;
grant all on public.loyalty_service_milestones to service_role;
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
  selected_visit_number integer := 0;
  visit_bonus boolean := false;
  granted_bonus integer := 0;
  eligible_visit uuid;
  inserted_visit uuid;
  visit_points integer := 0;
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

  -- Serializa también claves diferentes de un mismo cliente (cuotas, reparaciones y venta).
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_customer_id::text, 0));

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

  -- Una visita es un turno vinculado a una venta real, atendido y pagado.
  -- No se infiere del importe, del navegador ni del número de asientos.
  if p_sale_id is not null and p_amount > 0 then
    select a.id into eligible_visit
    from public.appointments a
    join public.sales s on s.id = a.sale_id and s.organization_id = a.organization_id
    where a.organization_id = p_organization_id and a.customer_id = p_customer_id
      and a.sale_id = p_sale_id and a.status = 'completed'
      and s.customer_id = p_customer_id and s.status in ('completed', 'completada')
      and public.loyalty_sale_fully_paid(p_organization_id, s.id)
      and s.created_at >= settings.service_visits_started_at
    order by a.id limit 1;
    if eligible_visit is not null then
      insert into public.loyalty_service_visits (organization_id, customer_id, appointment_id, sale_id)
      values (p_organization_id, p_customer_id, eligible_visit, p_sale_id)
      on conflict do nothing returning appointment_id into inserted_visit;
    end if;
  end if;
  if inserted_visit is not null and settings.earning_mode in ('visits', 'both') then
    visit_points := settings.points_per_visit;
  end if;

  base_points := public.calculate_base_loyalty_points(
    p_amount,
    settings.currency_per_point,
    settings.points_per_unit,
    settings.rounding
  );

  if settings.earning_mode = 'visits' then base_points := 0; end if;
  if base_points + visit_points <= 0 then
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
    and settings.earning_mode <> 'visits'
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
      and (settings.earning_mode = 'amount' or inserted_visit is not null)
      and r.visit_interval is not null
      and now() >= r.starts_at
      and now() < r.ends_at
      and (r.min_purchase_amount is null or p_amount >= r.min_purchase_amount)
    for update
  loop
    if settings.earning_mode = 'amount' then
    select count(*) + 1 into visit_number
    from public.loyalty_ledger l
    where l.organization_id = p_organization_id
      and l.customer_id = p_customer_id
      and l.source in ('purchase', 'promotion')
      and l.created_at >= visit_rule.starts_at;
    else
      select count(*) into visit_number from public.loyalty_service_visits v
      join public.appointments a on a.id = v.appointment_id and a.organization_id = v.organization_id
      join public.sales s on s.id = v.sale_id and s.organization_id = v.organization_id
      where v.organization_id = p_organization_id and v.customer_id = p_customer_id
        and v.created_at >= visit_rule.starts_at and a.status = 'completed'
        and public.loyalty_sale_fully_paid(p_organization_id, s.id)
        and v.refunded_amount < s.total_amount;
    end if;

    if visit_number > 0 and visit_number % visit_rule.visit_interval = 0 and visit_rule.bonus_points > bonus_points
      and (settings.earning_mode = 'amount' or not exists (
        select 1 from public.loyalty_service_milestones m where m.organization_id = p_organization_id
          and m.customer_id = p_customer_id and m.rule_id = visit_rule.id
          and m.cycle = visit_number / visit_rule.visit_interval
      )) then
      rule := visit_rule;
      has_rule := true;
      visit_bonus := true;
      selected_visit_number := visit_number;
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


  end if;

  total_points := base_points + visit_points + bonus_points;

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

  -- Distribuye el tope sobre los puntos efectivamente acreditados.
  base_points := least(base_points, total_points);
  visit_points := least(visit_points, greatest(0, total_points - base_points));
  bonus_points := least(bonus_points, greatest(0, total_points - base_points - visit_points));
  granted_bonus := bonus_points;
  if has_rule and granted_bonus > 0 then
    update public.loyalty_point_rules set awarded_bonus_points = awarded_bonus_points + granted_bonus where id = rule.id;
  end if;

  if visit_bonus and settings.earning_mode <> 'amount' and total_points > base_points + visit_points then
    insert into public.loyalty_service_milestones (organization_id,customer_id,rule_id,cycle)
    values (p_organization_id,p_customer_id,rule.id,selected_visit_number / rule.visit_interval)
    on conflict do nothing;
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
      when visit_points > 0 then format('Turno atendido y cobrado: %s puntos por visita + %s por monto + %s de bonificación', visit_points, base_points, bonus_points)
      when bonus_points > 0 and visit_bonus then
        format('Visita %s: %s puntos + %s de regalo (%s)', selected_visit_number, base_points, bonus_points, coalesce(rule.name, 'promoción'))
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


revoke all on function public.award_loyalty_points_for_sale(uuid,uuid,numeric,uuid,text) from public, anon;
grant execute on function public.award_loyalty_points_for_sale(uuid,uuid,numeric,uuid,text) to authenticated, service_role;

-- Consulta paginada con totales de toda la organización; búsqueda no modifica los totales.
create or replace function public.loyalty_program_customers(p_organization_id uuid, p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
declare result jsonb;
begin
  if not public.has_org_permission(p_organization_id, 'promotions.read') then
    raise exception 'No tenés permiso para consultar fidelización.' using errcode = '42501';
  end if;
  if length(coalesce(p_search, '')) > 100 or p_offset < 0 or p_offset > 100000 then
    raise exception 'Búsqueda inválida.' using errcode = '22023';
  end if;
  with visits as (
    select v.customer_id, count(*) as visits, max(v.created_at) as last_visit
    from public.loyalty_service_visits v
    join public.appointments a on a.id = v.appointment_id and a.organization_id = v.organization_id
    join public.sales s on s.id = v.sale_id and s.organization_id = v.organization_id
    where v.organization_id = p_organization_id and a.status = 'completed'
      and public.loyalty_sale_fully_paid(p_organization_id, s.id)
      and v.refunded_amount < s.total_amount
    group by v.customer_id
  ), participants as (
    select c.id, c.name, coalesce(l.balance,0) as balance, coalesce(v.visits,0) as visits, v.last_visit
    from public.customers c
    left join public.loyalty_accounts l on l.customer_id = c.id and l.organization_id = c.organization_id
    left join visits v on v.customer_id = c.id
    where c.organization_id = p_organization_id and (l.customer_id is not null or v.customer_id is not null)
  ), filtered as (
    select * from participants where position(lower(trim(coalesce(p_search,''))) in lower(name)) > 0
  ), page as (
    select * from filtered order by last_visit desc nulls last, id limit 25 offset p_offset
  )
  select jsonb_build_object(
    'customers', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'summary', jsonb_build_object(
      'customers', (select count(*) from participants),
      'visits', (select coalesce(sum(visits),0) from participants),
      'returningCustomers', (select count(*) from participants where visits >= 2),
      'redemptions', (select count(*) from public.loyalty_ledger where organization_id = p_organization_id and source = 'redemption')
    )
  ) into result;
  return result;
end $$;
revoke all on function public.loyalty_program_customers(uuid,text,integer) from public, anon;
grant execute on function public.loyalty_program_customers(uuid,text,integer) to authenticated, service_role;

create table if not exists public.loyalty_service_visit_refunds (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric not null check(amount > 0),
  primary key (organization_id, idempotency_key)
);
alter table public.loyalty_service_visit_refunds enable row level security;
revoke all on public.loyalty_service_visit_refunds from anon, authenticated;
grant all on public.loyalty_service_visit_refunds to service_role;
create or replace function public.reverse_loyalty_points_for_refund(
  p_organization_id uuid,
  p_customer_id uuid,
  p_sale_id uuid,
  p_refund_amount numeric,
  p_idempotency_key text
)
returns public.loyalty_ledger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  existing public.loyalty_ledger;
  inserted public.loyalty_ledger;
  earned integer := 0;
  already_reversed integer := 0;
  sale_total numeric := 0;
  current_balance integer := 0;
  to_remove integer := 0;
begin
  if p_organization_id is null or p_customer_id is null or p_sale_id is null or p_idempotency_key is null then
    raise exception 'Faltan datos para descontar los puntos.' using errcode = 'invalid_parameter_value';
  end if;

  -- Quien resuelve postventa o cobra en el POS.
  if not (
    public.has_org_permission(p_organization_id, 'crm.customers.manage')
    or public.has_org_permission(p_organization_id, 'pos.sales.create')
  ) then
    raise exception 'No tenés permiso para descontar puntos en esta organización.' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_customer_id::text, 0));
  if not exists (select 1 from public.sales where id = p_sale_id and organization_id = p_organization_id and customer_id = p_customer_id) then
    raise exception 'La venta no pertenece al cliente indicado.' using errcode = '22023';
  end if;
  if coalesce(p_refund_amount, 0) > 0 then
    insert into public.loyalty_service_visit_refunds (organization_id, idempotency_key, sale_id, customer_id, amount)
    values (p_organization_id, p_idempotency_key, p_sale_id, p_customer_id, p_refund_amount)
    on conflict do nothing;
    if found then
      update public.loyalty_service_visits set refunded_amount = refunded_amount + p_refund_amount
      where organization_id = p_organization_id and sale_id = p_sale_id and customer_id = p_customer_id;
    end if;
  end if;
  select * into existing
  from public.loyalty_ledger
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    return existing;
  end if;

  if coalesce(p_refund_amount, 0) <= 0 then
    return null;
  end if;

  select coalesce(sum(points), 0) into earned
  from public.loyalty_ledger
  where organization_id = p_organization_id
    and customer_id = p_customer_id
    and sale_id = p_sale_id
    and source in ('purchase', 'promotion');
  if earned <= 0 then
    return null;
  end if;

  select coalesce(-sum(points), 0) into already_reversed
  from public.loyalty_ledger
  where organization_id = p_organization_id
    and customer_id = p_customer_id
    and sale_id = p_sale_id
    and source = 'reversal';

  select coalesce(total_amount, 0) into sale_total
  from public.sales
  where id = p_sale_id and organization_id = p_organization_id;

  -- Proporcional al reintegro; sin total conocido, todo lo que sumó.
  to_remove := case
    when sale_total > 0 then ceil(earned * least(1, p_refund_amount / sale_total))::integer
    else earned
  end;
  to_remove := least(to_remove, earned - already_reversed);

  -- Lo que ya canjeó no se le puede sacar: el saldo nunca queda en negativo.
  select coalesce(balance, 0) into current_balance
  from public.loyalty_accounts
  where customer_id = p_customer_id
  for update;
  to_remove := least(to_remove, coalesce(current_balance, 0));

  if to_remove <= 0 then
    return null;
  end if;

  insert into public.loyalty_ledger (
    organization_id, customer_id, points, balance_after, source, description, sale_id, idempotency_key, created_by
  )
  values (
    p_organization_id, p_customer_id, -to_remove, 0, 'reversal',
    format('Devolución: se descuentan %s puntos de la compra', to_remove),
    p_sale_id, p_idempotency_key, auth.uid()
  )
  returning * into inserted;

  return inserted;
end;
$function$;

revoke all on function public.reverse_loyalty_points_for_refund(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.reverse_loyalty_points_for_refund(uuid, uuid, uuid, numeric, text) to authenticated, service_role;


commit;
