-- Puntos de fidelidad: devoluciones y vencimiento.
--
-- * Una devolución con reintegro no descontaba los puntos que había sumado la
--   venta. `reverse_loyalty_points_for_refund` descuenta la parte proporcional
--   al reintegro, una sola vez por caso, sin dejar el saldo en negativo.
-- * `points_expiration_months` se guardaba y cada asiento tenía su
--   `expires_at`, pero nada vencía los puntos. `expire_loyalty_points` lo hace;
--   pg_cron la corre todos los días a las 06:00 UTC (madrugada en Paraguay).

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_source_valid;
alter table public.loyalty_ledger add constraint loyalty_ledger_source_valid check (
  source = any (array['purchase', 'promotion', 'raffle_entry', 'raffle_refund', 'adjustment', 'expiration', 'reversal'])
);

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

/**
 * Vence los puntos con `expires_at` cumplido. Se consideran gastados primero
 * los más viejos: lo que se puede vencer es lo sumado que ya venció, menos lo
 * que el cliente gastó (canjes, devoluciones, ajustes en contra) y menos lo ya
 * vencido antes. Repetirla el mismo día no vence dos veces.
 */
create or replace function public.expire_loyalty_points(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  candidate record;
  due integer;
  expired_entries integer := 0;
begin
  for candidate in
    select
      l.organization_id,
      l.customer_id,
      coalesce(sum(l.points) filter (where l.points > 0 and l.expires_at is not null and l.expires_at <= p_now), 0) as expired_earned,
      coalesce(-sum(l.points) filter (where l.points < 0 and l.source <> 'expiration'), 0) as spent,
      coalesce(-sum(l.points) filter (where l.source = 'expiration'), 0) as already_expired
    from public.loyalty_ledger l
    group by l.organization_id, l.customer_id
    having coalesce(sum(l.points) filter (where l.points > 0 and l.expires_at is not null and l.expires_at <= p_now), 0) > 0
  loop
    due := greatest(0, candidate.expired_earned - candidate.spent - candidate.already_expired);
    if due <= 0 then
      continue;
    end if;

    select least(due, coalesce(balance, 0)) into due
    from public.loyalty_accounts
    where customer_id = candidate.customer_id
    for update;

    if coalesce(due, 0) <= 0 then
      continue;
    end if;

    insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description, idempotency_key)
    values (
      candidate.organization_id, candidate.customer_id, -due, 0, 'expiration',
      format('Vencimiento: %s puntos sin usar', due),
      format('expiration:%s:%s', candidate.customer_id, to_char(p_now at time zone 'UTC', 'YYYY-MM-DD'))
    )
    on conflict do nothing;

    expired_entries := expired_entries + 1;
  end loop;

  return expired_entries;
end;
$function$;

revoke all on function public.expire_loyalty_points(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_loyalty_points(timestamptz) to service_role;

-- Todos los días a las 06:00 UTC. Se consulta antes de des-programar: si la
-- tarea no existía, cron.unschedule falla y, con el bloque de excepción, la
-- tarea nunca quedaba programada.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'cron' and table_name = 'job') then
    if exists (select 1 from cron.job where jobname = 'loyalty_points_expiration') then
      perform cron.unschedule('loyalty_points_expiration');
    end if;
    perform cron.schedule('loyalty_points_expiration', '0 6 * * *', 'select public.expire_loyalty_points()');
  else
    raise notice 'pg_cron no está disponible: los puntos no vencen hasta programar expire_loyalty_points().';
  end if;
exception when others then
  raise notice 'No se pudo programar el vencimiento de puntos: %', sqlerrm;
end;
$$;
