-- =====================================================
-- COMPENSACIÓN DE TÉCNICOS
-- =====================================================
-- Config flexible por técnico (componentes combinables, cualquiera puede ser 0):
--   base_salary      -> sueldo fijo mensual
--   commission_rate  -> % sobre cada reparación cerrada
--   fixed_per_repair -> monto fijo por reparación cerrada
-- commission_base: sobre qué se calcula la comisión (mano de obra o total).
-- accrual_status : cuándo se devenga (al pasar a 'listo' o a 'entregado').

create table if not exists technician_compensation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  technician_id  uuid not null references profiles(id) on delete cascade,
  base_salary      numeric(14,2) not null default 0,
  commission_rate  numeric(5,2)  not null default 0,
  commission_base  text not null default 'labor'
                   check (commission_base in ('labor','final')),
  fixed_per_repair numeric(14,2) not null default 0,
  accrual_status   text not null default 'entregado'
                   check (accrual_status in ('listo','entregado')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, technician_id),
  constraint tc_commission_rate_range check (commission_rate >= 0 and commission_rate <= 100),
  constraint tc_base_salary_nonneg check (base_salary >= 0),
  constraint tc_fixed_nonneg check (fixed_per_repair >= 0)
);

create index if not exists idx_technician_compensation_org on technician_compensation(organization_id);

-- RLS: defensa en profundidad (la API usa service-role, pero igual scopeamos).
alter table technician_compensation enable row level security;

drop policy if exists tc_select on technician_compensation;
create policy tc_select on technician_compensation
  for select to authenticated
  using (
    has_org_permission(organization_id, 'settings.manage')
    or technician_id = (select auth.uid())   -- el técnico puede ver su propia config
  );

drop policy if exists tc_write on technician_compensation;
create policy tc_write on technician_compensation
  for all to authenticated
  using (has_org_permission(organization_id, 'settings.manage'))
  with check (has_org_permission(organization_id, 'settings.manage'));

comment on table technician_compensation is 'Compensación por técnico: sueldo base + comisión % + monto fijo por reparación.';
