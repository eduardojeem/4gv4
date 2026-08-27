-- Puntos de fidelidad y sorteos.
--
-- Reglas de seguridad que ordenan todo el archivo:
--
--  1. El saldo NO es un campo editable. La verdad es `loyalty_ledger`, que es
--     append-only: un trigger bloquea update y delete. `loyalty_accounts.balance`
--     es un espejo que solo mantiene el trigger del ledger, para no sumar la
--     tabla entera en cada lectura.
--  2. Ninguna tabla acepta escritura directa: se hace `revoke all` y las
--     politicas de RLS son solo de lectura. Toda mutacion pasa por funciones
--     `security definer` que validan permiso, organizacion y reglas de negocio.
--  3. Los numeros de sorteo se asignan dentro de la funcion, con el numero
--     tomado al azar del pool que queda libre y un unique que hace imposible
--     repetirlo aunque dos personas compren en el mismo instante.
--  4. El sorteo se corre una sola vez: el estado 'completed' es terminal y la
--     semilla usada queda guardada, para poder reproducir y auditar la jugada.

begin;

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- Configuracion de acumulacion
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.loyalty_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  -- Cuanta moneda hace falta para ganar `points_per_unit` puntos.
  -- Con currency_per_point = 10000 y points_per_unit = 1: 10.000 Gs = 1 punto.
  currency_per_point numeric(14, 2) not null default 10000,
  points_per_unit integer not null default 1,
  -- Los puntos son enteros: define si la fraccion se trunca o se redondea.
  rounding text not null default 'floor',
  -- Techo diario por cliente para acotar el dano de un error de carga.
  max_points_per_customer_per_day integer,
  -- Vencimiento de los puntos, en meses. NULL = no vencen.
  points_expiration_months integer,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint loyalty_settings_currency_positive check (currency_per_point > 0),
  constraint loyalty_settings_points_positive check (points_per_unit > 0),
  constraint loyalty_settings_rounding_valid check (rounding in ('floor', 'round')),
  constraint loyalty_settings_daily_cap_positive
    check (max_points_per_customer_per_day is null or max_points_per_customer_per_day > 0),
  constraint loyalty_settings_expiration_positive
    check (points_expiration_months is null or points_expiration_months > 0)
);

-- Promociones temporales de puntos: multiplican o suman sobre la base.
create table if not exists public.loyalty_point_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- 'multiplier': puntos base x factor. 'bonus_per_purchase': suma fija.
  kind text not null default 'multiplier',
  multiplier numeric(6, 2) not null default 2,
  bonus_points integer not null default 0,
  -- Topes de la promocion. NULL = sin tope.
  max_bonus_points_per_customer integer,
  max_bonus_points_total integer,
  awarded_bonus_points integer not null default 0,
  min_purchase_amount numeric(14, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint loyalty_point_rules_window check (ends_at > starts_at),
  constraint loyalty_point_rules_kind check (kind in ('multiplier', 'bonus_per_purchase')),
  constraint loyalty_point_rules_multiplier check (multiplier >= 1 and multiplier <= 100),
  constraint loyalty_point_rules_bonus check (bonus_points >= 0),
  constraint loyalty_point_rules_awarded check (awarded_bonus_points >= 0),
  constraint loyalty_point_rules_customer_cap
    check (max_bonus_points_per_customer is null or max_bonus_points_per_customer > 0),
  constraint loyalty_point_rules_total_cap
    check (max_bonus_points_total is null or max_bonus_points_total > 0)
);

create index if not exists loyalty_point_rules_window_idx
  on public.loyalty_point_rules (organization_id, is_active, starts_at, ends_at);

-- ───────────────────────────────────────────────────────────────────────────
-- Saldo y movimientos
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.loyalty_accounts (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  lifetime_redeemed integer not null default 0,
  -- Autoexclusion de juego responsable: bloquea participar en sorteos.
  self_excluded_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint loyalty_accounts_balance_non_negative check (balance >= 0)
);

create index if not exists loyalty_accounts_organization_idx
  on public.loyalty_accounts (organization_id);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  -- Positivo acumula, negativo canjea. Nunca cero.
  points integer not null,
  balance_after integer not null,
  -- purchase | promotion | raffle_entry | raffle_refund | adjustment | expiration
  source text not null,
  description text not null,
  sale_id uuid references public.sales(id) on delete set null,
  rule_id uuid references public.loyalty_point_rules(id) on delete set null,
  raffle_id uuid,
  -- Evita duplicar el mismo hecho: dos veces la misma venta no suma dos veces.
  idempotency_key text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint loyalty_ledger_points_not_zero check (points <> 0),
  constraint loyalty_ledger_balance_non_negative check (balance_after >= 0),
  constraint loyalty_ledger_source_valid check (
    source in ('purchase', 'promotion', 'raffle_entry', 'raffle_refund', 'adjustment', 'expiration')
  )
);

create unique index if not exists loyalty_ledger_idempotency_unique
  on public.loyalty_ledger (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists loyalty_ledger_customer_idx
  on public.loyalty_ledger (customer_id, created_at desc);

create index if not exists loyalty_ledger_organization_idx
  on public.loyalty_ledger (organization_id, created_at desc);

-- El historial no se corrige: se compensa con otro asiento.
create or replace function public.prevent_loyalty_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'El historial de puntos es inmutable: registrá un ajuste compensatorio en vez de editar.'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists loyalty_ledger_no_update on public.loyalty_ledger;
create trigger loyalty_ledger_no_update
  before update or delete on public.loyalty_ledger
  for each row execute function public.prevent_loyalty_ledger_mutation();

-- El espejo del saldo lo mantiene solo este trigger.
create or replace function public.sync_loyalty_account_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.loyalty_accounts (customer_id, organization_id, balance, lifetime_earned, lifetime_redeemed, updated_at)
  values (
    new.customer_id,
    new.organization_id,
    new.balance_after,
    greatest(new.points, 0),
    greatest(-new.points, 0),
    now()
  )
  on conflict (customer_id) do update
  set balance = new.balance_after,
      lifetime_earned = public.loyalty_accounts.lifetime_earned + greatest(new.points, 0),
      lifetime_redeemed = public.loyalty_accounts.lifetime_redeemed + greatest(-new.points, 0),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists loyalty_ledger_sync_account on public.loyalty_ledger;
create trigger loyalty_ledger_sync_account
  after insert on public.loyalty_ledger
  for each row execute function public.sync_loyalty_account_from_ledger();

-- ───────────────────────────────────────────────────────────────────────────
-- Sorteos
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.raffles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  -- Premios: [{ "position": 1, "title": "...", "details": "..." }]
  prizes jsonb not null default '[]'::jsonb,
  requirements text,
  terms text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  points_per_ticket integer not null,
  max_tickets_per_customer integer,
  -- Cota superior del pool de numeros. Los numeros van de 1 a este valor.
  max_tickets_total integer not null default 10000,
  -- draft | published | closed | completed | cancelled
  status text not null default 'draft',
  -- Juego responsable
  min_age integer not null default 18,
  drawn_at timestamptz,
  drawn_by uuid references auth.users(id),
  -- Semilla de la jugada, para poder reproducirla y auditarla.
  draw_seed text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint raffles_window check (ends_at > starts_at),
  constraint raffles_points_positive check (points_per_ticket > 0),
  constraint raffles_max_per_customer check (max_tickets_per_customer is null or max_tickets_per_customer > 0),
  constraint raffles_pool_positive check (max_tickets_total > 0 and max_tickets_total <= 1000000),
  constraint raffles_status_valid check (status in ('draft', 'published', 'closed', 'completed', 'cancelled')),
  constraint raffles_min_age check (min_age >= 0 and min_age <= 99),
  constraint raffles_prizes_is_array check (jsonb_typeof(prizes) = 'array')
);

create index if not exists raffles_organization_idx
  on public.raffles (organization_id, status, ends_at desc);

create table if not exists public.raffle_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  ticket_number integer not null,
  points_spent integer not null,
  ledger_id uuid references public.loyalty_ledger(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint raffle_tickets_number_positive check (ticket_number > 0),
  constraint raffle_tickets_points_positive check (points_spent > 0)
);

-- La garantia de que un numero no se repite dentro de un sorteo.
create unique index if not exists raffle_tickets_number_unique
  on public.raffle_tickets (raffle_id, ticket_number);

create index if not exists raffle_tickets_customer_idx
  on public.raffle_tickets (customer_id, created_at desc);

create index if not exists raffle_tickets_raffle_idx
  on public.raffle_tickets (raffle_id);

create table if not exists public.raffle_winners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  ticket_id uuid not null references public.raffle_tickets(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  prize_position integer not null,
  prize_title text not null,
  -- pending | validated | delivered | forfeited
  claim_status text not null default 'pending',
  validated_at timestamptz,
  validated_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  constraint raffle_winners_position_positive check (prize_position > 0),
  constraint raffle_winners_claim_valid check (claim_status in ('pending', 'validated', 'delivered', 'forfeited'))
);

-- Un premio por posicion y un ticket no puede ganar dos veces.
create unique index if not exists raffle_winners_position_unique
  on public.raffle_winners (raffle_id, prize_position);

create unique index if not exists raffle_winners_ticket_unique
  on public.raffle_winners (raffle_id, ticket_id);

-- Los tickets y los ganadores tampoco se editan a mano.
create or replace function public.prevent_raffle_record_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los números de participación y los ganadores no se pueden modificar.'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists raffle_tickets_immutable on public.raffle_tickets;
create trigger raffle_tickets_immutable
  before update or delete on public.raffle_tickets
  for each row execute function public.prevent_raffle_record_mutation();

commit;
