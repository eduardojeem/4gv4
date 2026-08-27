-- Correcciones de la auditoría de puntos y sorteos, verificadas contra la base.
--
-- Las dos migraciones anteriores ya estaban aplicadas cuando se encontraron
-- estas fallas, asi que corregir aquellos archivos no alcanzaba: no vuelven a
-- correr. Esta migracion pone al dia una base existente. Los archivos
-- originales tambien quedaron corregidos, para que una instalacion nueva nazca
-- bien; todo lo de aca es idempotente, asi que aplicar ambos caminos no rompe.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Carrera en el saldo
--
-- `award_loyalty_points_for_sale` y `adjust_loyalty_points` leian el saldo sin
-- bloquear y armaban el asiento con esa foto. Dos operaciones simultaneas sobre
-- el mismo cliente (dos cajas, o una venta y un ajuste) leian el mismo saldo y
-- la segunda pisaba a la primera: los puntos de una desaparecian sin error.
--
-- Ahora `balance_after` lo calcula un trigger BEFORE INSERT que bloquea la
-- cuenta, asi que el encadenamiento no depende de que el llamador acierte.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.compute_loyalty_balance_after()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  locked_balance integer;
begin
  -- Garantiza que la fila exista para poder bloquearla.
  insert into public.loyalty_accounts (customer_id, organization_id, balance)
  values (new.customer_id, new.organization_id, 0)
  on conflict (customer_id) do nothing;

  select balance into locked_balance
  from public.loyalty_accounts
  where customer_id = new.customer_id
  for update;

  new.balance_after := coalesce(locked_balance, 0) + new.points;

  if new.balance_after < 0 then
    raise exception 'La operación dejaría el saldo en negativo (saldo actual: %, movimiento: %).',
      coalesce(locked_balance, 0), new.points
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists loyalty_ledger_compute_balance on public.loyalty_ledger;
create trigger loyalty_ledger_compute_balance
  before insert on public.loyalty_ledger
  for each row execute function public.compute_loyalty_balance_after();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. El tope total de una promocion nunca se aplicaba
--
-- El trigger que protegia `awarded_bonus_points` comparaba
-- `current_setting('role')`. Verificado en esta base: ese valor es 'none' en
-- una sesion directa y 'authenticated' bajo PostgREST — nunca 'postgres', ni
-- siquiera dentro de una funcion security definer, porque lo que cambia ahi es
-- `current_user`, no ese GUC. Resultado: el trigger revertia el incremento que
-- hacia la propia acreditacion, el contador quedaba clavado en cero y una
-- campaña con tope de 500 puntos bonificaba sin limite.
--
-- Se reemplaza por un grant de update columna por columna: declarativo, y no
-- hay forma de eludirlo desde la API.
-- ───────────────────────────────────────────────────────────────────────────

drop trigger if exists loyalty_point_rules_protect_counter on public.loyalty_point_rules;
drop function if exists public.protect_loyalty_rule_counter();

revoke update on table public.loyalty_point_rules from authenticated;

grant update (
  name, description, starts_at, ends_at, kind, multiplier, bonus_points,
  max_bonus_points_per_customer, max_bonus_points_total, min_purchase_amount,
  is_active
) on table public.loyalty_point_rules to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Los borrados en cascada fallaban
--
-- Los triggers de inmutabilidad disparaban tambien en DELETE, asi que borrar un
-- sorteo o un cliente con numeros terminaba en un error incomprensible. La
-- escritura directa ya esta bloqueada por los grants (verificado: authenticated
-- solo tiene SELECT sobre ledger y tickets), asi que alcanza con cubrir UPDATE.
-- ───────────────────────────────────────────────────────────────────────────

drop trigger if exists loyalty_ledger_no_update on public.loyalty_ledger;
create trigger loyalty_ledger_no_update
  before update on public.loyalty_ledger
  for each row execute function public.prevent_loyalty_ledger_mutation();

drop trigger if exists raffle_tickets_immutable on public.raffle_tickets;
create trigger raffle_tickets_immutable
  before update on public.raffle_tickets
  for each row execute function public.prevent_raffle_record_mutation();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Clave foranea que faltaba
--
-- `loyalty_ledger.raffle_id` se declaro sin referencia porque `raffles` no
-- existia todavia en esa migracion, y nunca se cerro.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_raffle_id_fkey;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_raffle_id_fkey
  foreign key (raffle_id) references public.raffles(id) on delete set null;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. search_path mutable (lo marco el linter de Supabase)
--
-- Una funcion sin search_path fijo puede ejecutarse contra objetos de otro
-- esquema si alguien manipula el search_path de la sesion. Se fija en las
-- cuatro que quedaron sueltas.
-- ───────────────────────────────────────────────────────────────────────────

alter function public.prevent_loyalty_ledger_mutation() set search_path = pg_catalog, public;
alter function public.prevent_raffle_record_mutation() set search_path = pg_catalog, public;
alter function public.set_raffle_updated_at() set search_path = pg_catalog, public;
alter function public.calculate_base_loyalty_points(numeric, numeric, integer, text)
  set search_path = pg_catalog, public;

commit;
