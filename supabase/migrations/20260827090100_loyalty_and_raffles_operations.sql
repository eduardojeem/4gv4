-- Operaciones y permisos de puntos y sorteos.
--
-- Las tablas del archivo anterior no aceptan escritura directa. Todo lo que
-- muta saldo, numeros o ganadores entra por alguna de estas funciones, que
-- validan permiso, organizacion y reglas antes de escribir.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- Acumulacion
-- ───────────────────────────────────────────────────────────────────────────

-- Puntos base de una compra segun la configuracion de la organizacion.
-- El espejo en TypeScript (src/lib/loyalty/points.ts) calcula lo mismo para
-- previsualizar en el POS; el numero que se guarda es siempre el de acá.
create or replace function public.calculate_base_loyalty_points(
  p_amount numeric,
  p_currency_per_point numeric,
  p_points_per_unit integer,
  p_rounding text
)
returns integer
language plpgsql
immutable
as $$
declare
  raw_points numeric;
begin
  if p_amount is null or p_amount <= 0 or p_currency_per_point is null or p_currency_per_point <= 0 then
    return 0;
  end if;

  raw_points := (p_amount / p_currency_per_point) * coalesce(p_points_per_unit, 1);

  if p_rounding = 'round' then
    return greatest(0, round(raw_points)::integer);
  end if;

  return greatest(0, floor(raw_points)::integer);
end;
$$;

/**
 * Acredita los puntos de una venta.
 *
 * Idempotente por `p_idempotency_key`: reintentar la misma venta devuelve el
 * asiento ya creado en vez de sumar de nuevo. Aplica, en este orden, la tasa
 * base, la promocion temporal vigente y los topes (por cliente en la promo,
 * total de la promo y tope diario de la organizacion).
 */
create or replace function public.award_loyalty_points_for_sale(
  p_organization_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_sale_id uuid default null,
  p_idempotency_key text default null
)
returns public.loyalty_ledger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
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
begin
  if p_organization_id is null or p_customer_id is null then
    raise exception 'Falta la organización o el cliente.' using errcode = 'invalid_parameter_value';
  end if;

  -- 'pos.sales.create' es el permiso que tiene quien cierra una venta:
  -- cajero, vendedor, encargado, admin y dueño. Con un nombre que
  -- has_org_permission no conozca, solo pasarían dueño y admin y el POS
  -- dejaría de acreditar.
  if not public.has_org_permission(p_organization_id, 'pos.sales.create') then
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
  order by
    case when r.kind = 'multiplier' then base_points * (r.multiplier - 1) else r.bonus_points end desc
  limit 1
  for update;

  if found then
    if rule.kind = 'multiplier' then
      bonus_points := greatest(0, floor(base_points * (rule.multiplier - 1))::integer);
    else
      bonus_points := rule.bonus_points;
    end if;

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

    if bonus_points > 0 then
      update public.loyalty_point_rules
      set awarded_bonus_points = awarded_bonus_points + bonus_points
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
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Canje por numeros de sorteo
-- ───────────────────────────────────────────────────────────────────────────

/**
 * Canjea puntos por numeros de participacion.
 *
 * Los numeros salen al azar del pool que todavia esta libre. La equidad no
 * depende de esta consulta sino del unique (raffle_id, ticket_number): si dos
 * compras simultaneas eligen el mismo numero, una falla y reintenta.
 */
create or replace function public.redeem_points_for_raffle_tickets(
  p_raffle_id uuid,
  p_customer_id uuid,
  p_quantity integer
)
returns setof public.raffle_tickets
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  raffle public.raffles;
  account public.loyalty_accounts;
  cost integer;
  owned integer;
  issued integer;
  ledger_row public.loyalty_ledger;
  chosen integer;
  attempts integer;
  created_ids uuid[] := array[]::uuid[];
  new_ticket public.raffle_tickets;
  i integer;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'La cantidad de números debe estar entre 1 y 100.' using errcode = 'invalid_parameter_value';
  end if;

  -- Se bloquea el sorteo: el cupo total se evalua sin carreras.
  select * into raffle from public.raffles where id = p_raffle_id for update;

  if not found then
    raise exception 'El sorteo no existe.' using errcode = 'no_data_found';
  end if;

  -- El canje lo hace quien atiende el mostrador.
  if not public.has_org_permission(raffle.organization_id, 'pos.sales.create') then
    raise exception 'No tenés permiso sobre este sorteo.' using errcode = 'insufficient_privilege';
  end if;

  if raffle.status <> 'published' then
    raise exception 'El sorteo no está abierto a participación.' using errcode = 'invalid_parameter_value';
  end if;

  if now() < raffle.starts_at then
    raise exception 'El sorteo todavía no comenzó.' using errcode = 'invalid_parameter_value';
  end if;

  if now() >= raffle.ends_at then
    raise exception 'El sorteo ya cerró.' using errcode = 'invalid_parameter_value';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.organization_id = raffle.organization_id
  ) then
    raise exception 'El cliente no pertenece a la organización del sorteo.' using errcode = 'invalid_parameter_value';
  end if;

  select * into account
  from public.loyalty_accounts
  where customer_id = p_customer_id
  for update;

  if not found then
    raise exception 'El cliente no tiene puntos acumulados.' using errcode = 'invalid_parameter_value';
  end if;

  -- Juego responsable: la autoexclusion manda por encima del saldo.
  if account.self_excluded_until is not null and account.self_excluded_until > now() then
    raise exception 'El cliente está autoexcluido de participar hasta %.', account.self_excluded_until
      using errcode = 'invalid_parameter_value';
  end if;

  cost := raffle.points_per_ticket * p_quantity;

  if account.balance < cost then
    raise exception 'Puntos insuficientes: hacen falta % y hay %.', cost, account.balance
      using errcode = 'invalid_parameter_value';
  end if;

  -- Tope por cliente.
  if raffle.max_tickets_per_customer is not null then
    select count(*) into owned
    from public.raffle_tickets
    where raffle_id = p_raffle_id and customer_id = p_customer_id;

    if owned + p_quantity > raffle.max_tickets_per_customer then
      raise exception 'Máximo % números por cliente en este sorteo (ya tiene %).',
        raffle.max_tickets_per_customer, owned
        using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- Cupo del pool.
  select count(*) into issued from public.raffle_tickets where raffle_id = p_raffle_id;

  if issued + p_quantity > raffle.max_tickets_total then
    raise exception 'No quedan suficientes números: hay % libres.', raffle.max_tickets_total - issued
      using errcode = 'invalid_parameter_value';
  end if;

  -- Un solo asiento negativo por la operacion completa.
  insert into public.loyalty_ledger (
    organization_id, customer_id, points, balance_after, source, description, raffle_id, created_by
  )
  values (
    raffle.organization_id,
    p_customer_id,
    -cost,
    account.balance - cost,
    'raffle_entry',
    format('%s número(s) del sorteo "%s"', p_quantity, raffle.name),
    p_raffle_id,
    auth.uid()
  )
  returning * into ledger_row;

  for i in 1..p_quantity loop
    attempts := 0;

    loop
      attempts := attempts + 1;

      if attempts > 25 then
        raise exception 'No se pudo asignar un número libre. Volvé a intentar.' using errcode = 'restrict_violation';
      end if;

      select n into chosen
      from generate_series(1, raffle.max_tickets_total) as n
      where not exists (
        select 1 from public.raffle_tickets t
        where t.raffle_id = p_raffle_id and t.ticket_number = n
      )
      order by random()
      limit 1;

      if chosen is null then
        raise exception 'No quedan números libres en el sorteo.' using errcode = 'restrict_violation';
      end if;

      begin
        insert into public.raffle_tickets (
          organization_id, raffle_id, customer_id, ticket_number, points_spent, ledger_id
        )
        values (
          raffle.organization_id, p_raffle_id, p_customer_id, chosen,
          raffle.points_per_ticket, ledger_row.id
        )
        returning * into new_ticket;

        created_ids := created_ids || new_ticket.id;
        exit;
      exception
        when unique_violation then
          -- Otro canje se quedo con el numero entre el select y el insert.
          null;
      end;
    end loop;
  end loop;

  return query
  select * from public.raffle_tickets where id = any(created_ids) order by ticket_number;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Sorteo de ganadores
-- ───────────────────────────────────────────────────────────────────────────

/**
 * Elige los ganadores una sola vez.
 *
 * 'completed' es terminal, asi que no se puede repetir la jugada hasta que
 * salga el resultado deseado. La semilla queda guardada para reproducir el
 * orden y poder auditarlo.
 */
create or replace function public.draw_raffle_winners(
  p_raffle_id uuid,
  p_seed text default null
)
returns setof public.raffle_winners
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  raffle public.raffles;
  seed text;
  prize jsonb;
  position_index integer := 0;
  winner_ticket public.raffle_tickets;
  taken_customers uuid[] := array[]::uuid[];
  total_tickets integer;
begin
  select * into raffle from public.raffles where id = p_raffle_id for update;

  if not found then
    raise exception 'El sorteo no existe.' using errcode = 'no_data_found';
  end if;

  if not public.has_org_permission(raffle.organization_id, 'promotions.manage') then
    raise exception 'No tenés permiso para sortear.' using errcode = 'insufficient_privilege';
  end if;

  if raffle.status = 'completed' then
    raise exception 'Este sorteo ya fue realizado el %.', raffle.drawn_at
      using errcode = 'restrict_violation';
  end if;

  if raffle.status <> 'closed' and now() < raffle.ends_at then
    raise exception 'El sorteo sigue abierto: cerralo antes de sortear.' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(raffle.prizes) = 0 then
    raise exception 'El sorteo no tiene premios cargados.' using errcode = 'invalid_parameter_value';
  end if;

  select count(*) into total_tickets from public.raffle_tickets where raffle_id = p_raffle_id;

  if total_tickets = 0 then
    raise exception 'El sorteo no tiene participantes.' using errcode = 'invalid_parameter_value';
  end if;

  seed := coalesce(nullif(p_seed, ''), encode(gen_random_bytes(16), 'hex'));
  -- setseed acepta [-1, 1]: se deriva un valor estable a partir del texto.
  perform setseed(
    ((('x' || substr(md5(seed), 1, 8))::bit(32)::bigint % 1000000)::numeric / 1000000)::double precision
  );

  for prize in select * from jsonb_array_elements(raffle.prizes) loop
    position_index := position_index + 1;

    -- Una persona no se lleva dos premios del mismo sorteo.
    select t.* into winner_ticket
    from public.raffle_tickets t
    where t.raffle_id = p_raffle_id
      and not (t.customer_id = any(taken_customers))
    order by random()
    limit 1;

    exit when not found;

    taken_customers := taken_customers || winner_ticket.customer_id;

    insert into public.raffle_winners (
      organization_id, raffle_id, ticket_id, customer_id, prize_position, prize_title
    )
    values (
      raffle.organization_id,
      p_raffle_id,
      winner_ticket.id,
      winner_ticket.customer_id,
      coalesce((prize ->> 'position')::integer, position_index),
      coalesce(prize ->> 'title', format('Premio %s', position_index))
    );
  end loop;

  update public.raffles
  set status = 'completed',
      drawn_at = now(),
      drawn_by = auth.uid(),
      draw_seed = seed,
      updated_at = now()
  where id = p_raffle_id;

  return query
  select * from public.raffle_winners where raffle_id = p_raffle_id order by prize_position;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Ajuste manual, con rastro
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.adjust_loyalty_points(
  p_customer_id uuid,
  p_points integer,
  p_reason text
)
returns public.loyalty_ledger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  customer_org uuid;
  current_balance integer := 0;
  inserted public.loyalty_ledger;
begin
  if p_points = 0 then
    raise exception 'El ajuste no puede ser cero.' using errcode = 'invalid_parameter_value';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Todo ajuste manual necesita un motivo.' using errcode = 'invalid_parameter_value';
  end if;

  select organization_id into customer_org from public.customers where id = p_customer_id;

  if customer_org is null then
    raise exception 'El cliente no existe.' using errcode = 'no_data_found';
  end if;

  if not public.has_org_permission(customer_org, 'promotions.manage') then
    raise exception 'No tenés permiso para ajustar puntos.' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(balance, 0) into current_balance
  from public.loyalty_accounts where customer_id = p_customer_id;

  current_balance := coalesce(current_balance, 0);

  if current_balance + p_points < 0 then
    raise exception 'El ajuste dejaría el saldo en negativo (saldo actual: %).', current_balance
      using errcode = 'check_violation';
  end if;

  insert into public.loyalty_ledger (
    organization_id, customer_id, points, balance_after, source, description, created_by
  )
  values (
    customer_org, p_customer_id, p_points, current_balance + p_points,
    'adjustment', trim(p_reason), auth.uid()
  )
  returning * into inserted;

  return inserted;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Autoexclusion (juego responsable)
-- ───────────────────────────────────────────────────────────────────────────

/**
 * Registra o levanta la autoexclusion de un cliente.
 *
 * `loyalty_accounts` no acepta escritura directa, asi que esta es la unica
 * forma de tocar el campo. Levantar una exclusion vigente exige permiso de
 * gestion: no puede hacerlo el mismo mostrador que vende los numeros.
 */
create or replace function public.set_loyalty_self_exclusion(
  p_customer_id uuid,
  p_until timestamptz
)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  customer_org uuid;
  account public.loyalty_accounts;
  updated public.loyalty_accounts;
begin
  select organization_id into customer_org from public.customers where id = p_customer_id;

  if customer_org is null then
    raise exception 'El cliente no existe.' using errcode = 'no_data_found';
  end if;

  select * into account from public.loyalty_accounts where customer_id = p_customer_id;

  -- Registrar una exclusion lo puede hacer quien atiende: es a pedido del
  -- cliente y siempre es la opcion segura.
  if p_until is not null and p_until > now() then
    if not public.has_org_permission(customer_org, 'pos.sales.create') then
      raise exception 'No tenés permiso sobre este cliente.' using errcode = 'insufficient_privilege';
    end if;
  else
    -- Levantarla es lo delicado: solo gestion.
    if not public.has_org_permission(customer_org, 'promotions.manage') then
      raise exception 'Solo un administrador puede levantar una autoexclusión.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if account.customer_id is null then
    insert into public.loyalty_accounts (customer_id, organization_id, balance, self_excluded_until)
    values (p_customer_id, customer_org, 0, p_until)
    returning * into updated;
  else
    update public.loyalty_accounts
    set self_excluded_until = p_until,
        updated_at = now()
    where customer_id = p_customer_id
    returning * into updated;
  end if;

  return updated;
end;
$$;

-- `loyalty_ledger.raffle_id` se declara sin referencia en la migracion
-- anterior porque `raffles` todavia no existia. Se cierra aca.
alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_raffle_id_fkey;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_raffle_id_fkey
  foreign key (raffle_id) references public.raffles(id) on delete set null;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS: solo lectura, y solo dentro de la organizacion
-- ───────────────────────────────────────────────────────────────────────────

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_point_rules enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.raffles enable row level security;
alter table public.raffle_tickets enable row level security;
alter table public.raffle_winners enable row level security;

drop policy if exists loyalty_settings_read on public.loyalty_settings;
create policy loyalty_settings_read on public.loyalty_settings
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

drop policy if exists loyalty_point_rules_read on public.loyalty_point_rules;
create policy loyalty_point_rules_read on public.loyalty_point_rules
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

drop policy if exists loyalty_accounts_read on public.loyalty_accounts;
create policy loyalty_accounts_read on public.loyalty_accounts
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

drop policy if exists loyalty_ledger_read on public.loyalty_ledger;
create policy loyalty_ledger_read on public.loyalty_ledger
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

drop policy if exists raffles_read on public.raffles;
create policy raffles_read on public.raffles
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

drop policy if exists raffle_tickets_read on public.raffle_tickets;
create policy raffle_tickets_read on public.raffle_tickets
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

drop policy if exists raffle_winners_read on public.raffle_winners;
create policy raffle_winners_read on public.raffle_winners
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'crm.customers.read')
);

-- Nadie escribe estas tablas por PostgREST: ni el saldo ni los numeros.
-- La unica puerta son las funciones de arriba.
revoke all on table public.loyalty_settings from public, anon, authenticated;
revoke all on table public.loyalty_point_rules from public, anon, authenticated;
revoke all on table public.loyalty_accounts from public, anon, authenticated;
revoke all on table public.loyalty_ledger from public, anon, authenticated;
revoke all on table public.raffles from public, anon, authenticated;
revoke all on table public.raffle_tickets from public, anon, authenticated;
revoke all on table public.raffle_winners from public, anon, authenticated;

grant select on table public.loyalty_settings to authenticated;
grant select on table public.loyalty_point_rules to authenticated;
grant select on table public.loyalty_accounts to authenticated;
grant select on table public.loyalty_ledger to authenticated;
grant select on table public.raffles to authenticated;
grant select on table public.raffle_tickets to authenticated;
grant select on table public.raffle_winners to authenticated;

-- La configuracion y los sorteos se crean/editan desde el panel, con permiso
-- de gestion. Se habilita escritura acotada por RLS solo para estas dos.
drop policy if exists loyalty_settings_write on public.loyalty_settings;
create policy loyalty_settings_write on public.loyalty_settings
for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'promotions.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'promotions.manage')
);

drop policy if exists loyalty_point_rules_write on public.loyalty_point_rules;
create policy loyalty_point_rules_write on public.loyalty_point_rules
for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'promotions.manage')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'promotions.manage')
);

drop policy if exists raffles_write on public.raffles;
create policy raffles_write on public.raffles
for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'promotions.manage')
  -- Un sorteo ya realizado no se toca.
  and status <> 'completed'
)
with check (
  organization_id = public.current_organization_id()
  and public.has_org_permission(organization_id, 'promotions.manage')
);

grant insert, update on table public.loyalty_settings to authenticated;
grant insert, delete on table public.loyalty_point_rules to authenticated;
grant insert, update, delete on table public.raffles to authenticated;

-- Update columna por columna: todo menos el contador de bonificacion.
grant update (
  name, description, starts_at, ends_at, kind, multiplier, bonus_points,
  max_bonus_points_per_customer, max_bonus_points_total, min_purchase_amount,
  is_active
) on table public.loyalty_point_rules to authenticated;

-- `awarded_bonus_points` lo lleva la funcion de acreditacion: si se pudiera
-- editar a mano, el cupo de la promocion dejaria de significar algo.
--
-- Se protege con un grant por columna y no con un trigger. Un trigger que
-- mirara `current_setting('role')` no serviria: bajo PostgREST ese GUC vale
-- 'authenticated' incluso dentro de una funcion security definer, asi que
-- habria revertido el incremento hecho por la propia acreditacion y el cupo
-- total nunca se habria aplicado.
drop trigger if exists loyalty_point_rules_protect_counter on public.loyalty_point_rules;
drop function if exists public.protect_loyalty_rule_counter();

create or replace function public.set_raffle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists raffles_set_updated_at on public.raffles;
create trigger raffles_set_updated_at
  before update on public.raffles
  for each row execute function public.set_raffle_updated_at();

revoke all on function public.award_loyalty_points_for_sale(uuid, uuid, numeric, uuid, text) from public, anon;
revoke all on function public.redeem_points_for_raffle_tickets(uuid, uuid, integer) from public, anon;
revoke all on function public.draw_raffle_winners(uuid, text) from public, anon;
revoke all on function public.adjust_loyalty_points(uuid, integer, text) from public, anon;
revoke all on function public.set_loyalty_self_exclusion(uuid, timestamptz) from public, anon;

grant execute on function public.award_loyalty_points_for_sale(uuid, uuid, numeric, uuid, text) to authenticated;
grant execute on function public.redeem_points_for_raffle_tickets(uuid, uuid, integer) to authenticated;
grant execute on function public.draw_raffle_winners(uuid, text) to authenticated;
grant execute on function public.adjust_loyalty_points(uuid, integer, text) to authenticated;
grant execute on function public.set_loyalty_self_exclusion(uuid, timestamptz) to authenticated;
grant execute on function public.calculate_base_loyalty_points(numeric, numeric, integer, text) to authenticated;

commit;
