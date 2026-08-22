-- Encuentra sucursales ACTIVAS con nombre repetido dentro de la misma
-- organización. Estas son las que se ven como "muchas sucursales" iguales
-- en el selector, porque la unicidad de la base solo cubre (code, slug),
-- nunca el nombre visible.
--
-- Cómo usarlo: pegalo en el SQL Editor de Supabase (o psql) de tu proyecto.
-- Solo LEE datos, no modifica nada.

-- 1) Resumen: qué nombres están repetidos y cuántas veces, por organización.
select
  b.organization_id,
  o.name                     as organization_name,
  lower(trim(b.name))        as nombre_normalizado,
  count(*)                   as cantidad,
  array_agg(b.id order by b.created_at) as branch_ids,
  array_agg(b.code order by b.created_at) as codes
from public.branches b
join public.organizations o on o.id = b.organization_id
where b.is_active = true
group by b.organization_id, o.name, lower(trim(b.name))
having count(*) > 1
order by o.name, cantidad desc;

-- 2) Detalle fila por fila de esas sucursales duplicadas, para decidir cuál
--    conservar y cuál renombrar/desactivar. Ordenadas por org y nombre.
select
  b.id,
  b.organization_id,
  b.name,
  b.code,
  b.slug,
  b.city,
  b.is_default,
  b.is_active,
  b.created_at
from public.branches b
join (
  select organization_id, lower(trim(name)) as nombre_normalizado
  from public.branches
  where is_active = true
  group by organization_id, lower(trim(name))
  having count(*) > 1
) dup
  on dup.organization_id = b.organization_id
 and dup.nombre_normalizado = lower(trim(b.name))
where b.is_active = true
order by b.organization_id, lower(trim(b.name)), b.created_at;
