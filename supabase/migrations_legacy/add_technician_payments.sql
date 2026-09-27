-- =====================================================
-- PAGOS A TÉCNICOS (nómina: sueldos + comisiones)
-- =====================================================
-- Registra lo que efectivamente se le paga al técnico por período.
-- Saldo a pagar = devengado (earnings) - Σ pagos (status <> 'anulado').
-- Confirmación doble: admin deja el pago en 'pagado'; el técnico acusa
-- recibo (confirmed_by/at) pasándolo a 'confirmado'.

create table if not exists technician_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  technician_id  uuid not null references profiles(id) on delete cascade,
  period_from date not null,
  period_to   date not null,
  amount            numeric(14,2) not null check (amount >= 0),
  base_amount       numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  fixed_amount      numeric(14,2) not null default 0,
  method text not null default 'efectivo'
         check (method in ('efectivo','transferencia','otro')),
  status text not null default 'pagado'
         check (status in ('pendiente','pagado','confirmado','anulado')),
  notes text,
  paid_by uuid references profiles(id),
  paid_at timestamptz default now(),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  -- Movimiento de caja asociado (si se pagó en efectivo por caja)
  cash_movement_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_technician_payments_org_tech
  on technician_payments(organization_id, technician_id, period_from);

alter table technician_payments enable row level security;

-- Lectura: admins de la org, o el técnico su propio pago.
drop policy if exists tp_select on technician_payments;
create policy tp_select on technician_payments
  for select to authenticated
  using (
    has_org_permission(organization_id, 'settings.manage')
    or technician_id = (select auth.uid())
  );

-- Alta/edición: admins con settings.manage.
drop policy if exists tp_write on technician_payments;
create policy tp_write on technician_payments
  for all to authenticated
  using (has_org_permission(organization_id, 'settings.manage'))
  with check (has_org_permission(organization_id, 'settings.manage'));

comment on table technician_payments is 'Pagos de nómina a técnicos (sueldos/comisiones) con confirmación doble y vínculo a caja.';
