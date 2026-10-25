-- Débito automático de la suscripción con tarjeta guardada en Pagopar/uPay.
-- Una fila por organización. pagopar_customer_id es el "identificador"
-- numérico que Pagopar asocia a las tarjetas: no se expone el UUID interno.
-- Solo el servidor (service_role) lee y escribe esta tabla.

create table public.subscription_autopay (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pagopar_customer_id bigint generated always as identity unique,
  provider text not null default 'uPay' check (provider in ('uPay', 'Bancard')),
  enabled boolean not null default false,
  card_status text not null default 'none' check (card_status in ('none', 'pending', 'active')),
  card_brand text,
  card_masked text,
  card_type text,
  card_issuer text,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 3),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or card_status = 'active')
);

create index subscription_autopay_due
  on public.subscription_autopay(next_attempt_at)
  where enabled and card_status = 'active' and suspended_at is null;

alter table public.subscription_autopay enable row level security;
revoke all on public.subscription_autopay from public, anon, authenticated;
grant all on public.subscription_autopay to service_role;
