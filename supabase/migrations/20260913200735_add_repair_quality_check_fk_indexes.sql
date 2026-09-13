-- Índices de soporte para las claves foráneas del historial de verificaciones.
-- Evitan escaneos completos al filtrar por sucursal o por responsable.
begin;

create index if not exists repair_quality_checks_branch_id_idx
  on public.repair_quality_checks (branch_id);

create index if not exists repair_quality_checks_created_by_idx
  on public.repair_quality_checks (created_by);

commit;
