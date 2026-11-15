-- Columnas para comisiones en barberías y salones de belleza
alter table public.agenda_professionals
  add column if not exists remuneration_type text default 'commission' check (remuneration_type in ('commission', 'fixed', 'hybrid', 'chair_rental')),
  add column if not exists commission_rate_services numeric(5,2) default 50.00 check (commission_rate_services >= 0 and commission_rate_services <= 100),
  add column if not exists commission_rate_products numeric(5,2) default 10.00 check (commission_rate_products >= 0 and commission_rate_products <= 100),
  add column if not exists commission_fixed_deduction numeric(12,2) default 0.00 check (commission_fixed_deduction >= 0);

comment on column public.agenda_professionals.remuneration_type is 'Tipo de remuneración: commission (comisionista puro), fixed (sueldo fijo), hybrid (fijo + comisión), chair_rental (alquiler de sillón)';
comment on column public.agenda_professionals.commission_rate_services is 'Porcentaje de comisión sobre servicios (ej. 50% en cortes/barbas)';
comment on column public.agenda_professionals.commission_rate_products is 'Porcentaje de comisión sobre venta de productos de reventa (ej. 10% en pomadas/ceras)';
comment on column public.agenda_professionals.commission_fixed_deduction is 'Monto fijo descontado por servicio atendido por insumos descartables (hojas, toallas)';

-- Tabla para almacenar el historial de liquidaciones pagadas a barberos y profesionales
create table if not exists public.agenda_professional_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.agenda_professionals(id) on delete cascade,
  professional_name text not null,
  receipt_code text not null,
  period_preset text not null default 'this_week',
  period_from date not null,
  period_to date not null,
  appointments_count integer not null default 0,
  total_billed numeric(12,2) not null default 0.00,
  commission_rate numeric(5,2) not null default 50.00,
  commission_amount numeric(12,2) not null default 0.00,
  deductions_amount numeric(12,2) not null default 0.00,
  advances_vales_amount numeric(12,2) not null default 0.00,
  tips_amount numeric(12,2) not null default 0.00,
  net_amount numeric(12,2) not null default 0.00,
  remuneration_type text not null default 'commission',
  payment_method text not null default 'cash' check (payment_method in ('cash', 'transfer', 'qr')),
  payment_reference text,
  cash_movement_id uuid references public.cash_movements(id) on delete set null,
  notes text,
  status text not null default 'paid' check (status in ('paid', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Índices para consultas eficientes
create index if not exists idx_agenda_settlements_org on public.agenda_professional_settlements(organization_id, settled_at desc);
create index if not exists idx_agenda_settlements_prof on public.agenda_professional_settlements(organization_id, professional_id, settled_at desc);
create unique index if not exists idx_agenda_settlements_receipt on public.agenda_professional_settlements(organization_id, receipt_code);

-- Seguridad RLS
alter table public.agenda_professional_settlements enable row level security;

drop policy if exists "tenant members can read agenda settlements" on public.agenda_professional_settlements;
create policy "tenant members can read agenda settlements"
  on public.agenda_professional_settlements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = agenda_professional_settlements.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "admins and owners can manage agenda settlements" on public.agenda_professional_settlements;
create policy "admins and owners can manage agenda settlements"
  on public.agenda_professional_settlements
  for all
  to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = agenda_professional_settlements.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = agenda_professional_settlements.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.agenda_professional_settlements to authenticated;
grant all on public.agenda_professional_settlements to service_role;
