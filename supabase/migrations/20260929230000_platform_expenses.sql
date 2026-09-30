-- Gastos operativos de la plataforma SaaS (infraestructura, herramientas,
-- comisiones, marketing...). Son costos del operador, no de las tiendas: solo
-- super_admin los ve o modifica. La app accede con service_role desde server
-- actions que validan super_admin; la politica RLS es la segunda barrera.

create table if not exists public.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  category text not null check (category in (
    'infraestructura', 'herramientas', 'comisiones', 'marketing', 'personal', 'legal', 'otros'
  )),
  description text check (description is null or char_length(description) <= 500),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency in ('PYG', 'USD')),
  -- Guaranies por unidad de la moneda del gasto, fijado al cargarlo para que el
  -- historico no cambie cuando cambia el dolar.
  fx_rate_pyg numeric(14, 4) not null default 1 check (fx_rate_pyg > 0),
  recurrence text not null check (recurrence in ('monthly', 'yearly', 'one_time')),
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_expenses_pyg_rate check (currency <> 'PYG' or fx_rate_pyg = 1),
  constraint platform_expenses_dates check (ends_on is null or ends_on >= starts_on)
);

create index if not exists platform_expenses_active_starts_idx
  on public.platform_expenses (is_active, starts_on);

alter table public.platform_expenses enable row level security;

drop policy if exists platform_expenses_superadmin_all on public.platform_expenses;
create policy platform_expenses_superadmin_all
  on public.platform_expenses
  for all
  to authenticated
  using ((select public.get_jwt_role()) = 'super_admin')
  with check ((select public.get_jwt_role()) = 'super_admin');

revoke all on public.platform_expenses from anon;
