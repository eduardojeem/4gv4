-- Verificación de 01 + 04, SOLO LECTURA y solo metadatos (no lee datos de negocio).
-- Antes de aplicar: muestra el estado esperado «previo». Después: todo debe dar PASS.
-- Uso: ejecutar dentro de una transacción de solo lectura, por ejemplo
--   begin transaction read only; \i verify_s1b.sql; rollback;
-- o pegarlo en el SQL Editor (no modifica nada).
with fn as (
  select md5(prosrc) h, prosrc, proacl::text acl from pg_proc where proname = 'has_org_permission' and pronamespace = 'public'::regnamespace
), checks(orden, verificacion, previo, despues) as (values
  (1, 'has_org_permission: cuerpo de producción del 2026-10-20 (previo) o corregido (después)',
     (select h = '0b576a5b853e89b067f927b190a9d63d' from fn), (select h = '097f32e5a71cb580ca1ce3247357168f' from fn)),
  (2, 'has_org_permission: el rol customer no recibe repairs.orders.read',
     (select prosrc ~ 'member_role = ''customer'' and permission_name = ''repairs.orders.read''' from fn), (select prosrc !~ 'member_role = ''customer'' and permission_name' from fn)),
  (3, 'has_org_permission: EXECUTE para authenticated conservado',
     (select acl ~ 'authenticated=X' from fn), (select acl ~ 'authenticated=X' from fn)),
  (4, '01: has_product_cost_access existe y anon no la ejecuta',
     not exists (select 1 from pg_proc where proname = 'has_product_cost_access'),
     exists (select 1 from pg_proc p where p.proname = 'has_product_cost_access' and not has_function_privilege('anon', p.oid, 'EXECUTE'))),
  (5, '01: triggers de escritura de costos en products y product_variants',
     not exists (select 1 from pg_trigger where tgname in ('products_aa_guard_cost_writes', 'product_variants_aa_guard_cost_writes')),
     (select count(*) = 2 from pg_trigger where tgname in ('products_aa_guard_cost_writes', 'product_variants_aa_guard_cost_writes') and tgenabled = 'O')),
  (6, '04: políticas de solo miembro eliminadas (5)',
     (select count(*) = 5 from pg_policies where schemaname = 'public' and policyname in ('tenant members read order cost snapshots', 'repair_cost_revisions_tenant_read', 'repair_cost_revision_parts_tenant_read', 'Org staff can read status history', 'repair_images_tenant_select')),
     not exists (select 1 from pg_policies where schemaname = 'public' and policyname in ('tenant members read order cost snapshots', 'repair_cost_revisions_tenant_read', 'repair_cost_revision_parts_tenant_read', 'Org staff can read status history', 'repair_images_tenant_select'))),
  (7, '04: políticas de costo con products.read_cost (3)',
     not exists (select 1 from pg_policies where schemaname = 'public' and policyname like '%\_cost\_read' escape '\'),
     (select count(*) = 3 from pg_policies where schemaname = 'public' and policyname in ('customer_order_item_cost_snapshots_cost_read', 'repair_cost_revisions_cost_read', 'repair_cost_revision_parts_cost_read')
        and qual ~ 'has_product_cost_access')),
  (8, 'Se conservan las políticas del personal (historial, imágenes, notas, créditos)',
     (select count(*) = 4 from pg_policies where schemaname = 'public' and policyname in ('repair_status_history_select_org_staff', 'repair_images_select_org_staff_or_owner', 'repair_notes_select_org_staff', 'tenant staff can read customer credits')),
     (select count(*) = 4 from pg_policies where schemaname = 'public' and policyname in ('repair_status_history_select_org_staff', 'repair_images_select_org_staff_or_owner', 'repair_notes_select_org_staff', 'tenant staff can read customer credits'))),
  (9, 'RLS activa en las tablas tocadas',
     (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('customers', 'repair_payments', 'repair_closeouts', 'repair_quality_checks', 'repair_cost_revisions', 'repair_cost_revision_parts', 'customer_order_item_cost_snapshots', 'repair_status_history', 'repair_images')),
     (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('customers', 'repair_payments', 'repair_closeouts', 'repair_quality_checks', 'repair_cost_revisions', 'repair_cost_revision_parts', 'customer_order_item_cost_snapshots', 'repair_status_history', 'repair_images'))),
  (10, '02/03 todavía NO aplicadas (no son parte de este despliegue)',
     not exists (select 1 from pg_proc where proname = 'get_product_costs') and has_table_privilege('authenticated', 'public.products', 'SELECT'),
     not exists (select 1 from pg_proc where proname = 'get_product_costs') and has_table_privilege('authenticated', 'public.products', 'SELECT'))
)
select orden, verificacion,
  case when previo then 'PASS' else 'FAIL' end as antes_de_aplicar,
  case when despues then 'PASS' else 'FAIL' end as despues_de_aplicar
from checks order by orden;
