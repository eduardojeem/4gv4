-- BORRADOR PARA REVISIÓN — NO EJECUTAR EN PRODUCCIÓN.
-- S1b: cerrar la lectura por la Data API de datos de personal y costos internos que
-- hoy alcanzan al rol `customer` y a cualquier miembro. Confirmado en producción
-- (solo metadatos, 2026-10-20). Requiere 01 (has_product_cost_access).
-- Reversión: rollback_04.sql (restaura las políticas y la función de producción).
--
-- Ningún código de la web ni de Expo lee estas tablas con la sesión del usuario:
-- las APIs usan el rol de servicio. El cambio solo afecta a la Data API directa.

begin;
-- Si una tabla está ocupada, abortar en vez de dejar la tienda esperando.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Salvaguarda: has_org_permission tiene que ser la versión leída de producción el
-- 2026-10-20 (o esta misma versión corregida, si se vuelve a ejecutar). Si alguien la
-- cambió después, se aborta: el reemplazo y rollback_04 dejarían de ser exactos.
do $$
declare v_md5 text;
begin
  select md5(prosrc) into v_md5 from pg_proc where proname = 'has_org_permission' and pronamespace = 'public'::regnamespace;
  if v_md5 is distinct from '0b576a5b853e89b067f927b190a9d63d' and v_md5 is distinct from '097f32e5a71cb580ca1ce3247357168f' then
    raise exception 'has_org_permission cambió desde la verificación (md5 %): revisar la 04 antes de aplicarla.', v_md5;
  end if;
  if not exists (select 1 from pg_proc where proname = 'has_product_cost_access' and pronamespace = 'public'::regnamespace) then
    raise exception 'Falta has_product_cost_access: aplicar primero 01_guard_product_cost_writes.sql.';
  end if;
end $$;

-- 1) has_org_permission: el rol customer ya no tiene 'repairs.orders.read'.
--    Cierra customers, repair_payments, repair_closeouts y repair_quality_checks.
CREATE OR REPLACE FUNCTION public.has_org_permission(target_organization_id uuid, permission_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  member_role public.organization_role;
begin
  member_role := public.get_org_role(target_organization_id);

  if member_role is null then return false; end if;
  if member_role = 'owner' then return true; end if;
  if member_role = 'admin' then return permission_name <> 'billing.manage'; end if;

  if member_role = 'manager' then
    return permission_name = any(array[
      'inventory.products.read', 'inventory.products.create', 'inventory.products.update',
      'inventory.stock.manage', 'pos.sales.read', 'pos.sales.create', 'pos.cash.manage',
      'repairs.orders.read', 'repairs.orders.create', 'repairs.orders.update',
      'repairs.orders.assign', 'repairs.orders.deliver', 'crm.customers.read',
      'crm.customers.manage', 'promotions.read', 'promotions.create',
      'promotions.update', 'analytics.read'
    ]);
  end if;

  if member_role = 'cashier' then
    return permission_name = any(array[
      'inventory.products.read', 'pos.sales.read', 'pos.sales.create',
      'pos.cash.manage', 'crm.customers.read', 'repairs.orders.read',
      'repairs.orders.deliver'
    ]);
  end if;

  if member_role = 'technician' then
    return permission_name = any(array[
      'inventory.products.read', 'inventory.stock.manage', 'repairs.orders.read',
      'repairs.orders.update', 'repairs.orders.deliver'
    ]);
  end if;

  if member_role = 'seller' then
    return permission_name = any(array[
      'inventory.products.read', 'pos.sales.read', 'pos.sales.create',
      'crm.customers.read', 'crm.customers.manage', 'promotions.read',
      'promotions.create', 'promotions.update'
    ]);
  end if;

  -- S1b: el rol customer no recibe permisos de personal. Su portal ('mis
  -- reparaciones', perfil) lee con el rol de servicio filtrando por su propia ficha
  -- (customers.profile_id); con 'repairs.orders.read' podía leer por la Data API
  -- todos los clientes, pagos, cierres y controles de calidad del comercio.
  return false;
end;
$function$
;

-- 2) Costos internos de pedidos: solo con products.read_cost en esa organización
--    (antes: cualquier miembro, incluido customer).
drop policy if exists "tenant members read order cost snapshots" on public.customer_order_item_cost_snapshots;
drop policy if exists customer_order_item_cost_snapshots_cost_read on public.customer_order_item_cost_snapshots;
create policy customer_order_item_cost_snapshots_cost_read on public.customer_order_item_cost_snapshots
  as permissive for select to authenticated
  using (public.has_product_cost_access(organization_id, 'products.read_cost'));

-- 3) Revisiones de costo de reparaciones (costo interno de repuestos y materiales):
--    solo con products.read_cost (antes: cualquier miembro activo).
drop policy if exists repair_cost_revisions_tenant_read on public.repair_cost_revisions;
drop policy if exists repair_cost_revisions_cost_read on public.repair_cost_revisions;
create policy repair_cost_revisions_cost_read on public.repair_cost_revisions
  as permissive for select to authenticated
  using (public.has_product_cost_access(organization_id, 'products.read_cost'));
drop policy if exists repair_cost_revision_parts_tenant_read on public.repair_cost_revision_parts;
drop policy if exists repair_cost_revision_parts_cost_read on public.repair_cost_revision_parts;
create policy repair_cost_revision_parts_cost_read on public.repair_cost_revision_parts
  as permissive for select to authenticated
  using (public.has_product_cost_access(organization_id, 'products.read_cost'));

-- 4) Historial de estados e imágenes: se quita la política que solo exigía ser
--    miembro. Queda la que ya existía para el personal (excluye a customer) y, en
--    imágenes, la del cliente dueño de la reparación.
drop policy if exists "Org staff can read status history" on public.repair_status_history;
drop policy if exists repair_images_tenant_select on public.repair_images;

commit;
