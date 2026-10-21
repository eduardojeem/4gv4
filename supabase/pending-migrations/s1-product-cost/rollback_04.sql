-- Reversión de 04: deja las políticas y has_org_permission como estaban en producción el 2026-10-20.
begin;
-- Si una tabla está ocupada, abortar en vez de dejar la tienda esperando.
set local lock_timeout = '5s';
set local statement_timeout = '60s';
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

  return member_role = 'customer' and permission_name = 'repairs.orders.read';
end;
$function$
;
drop policy if exists customer_order_item_cost_snapshots_cost_read on public.customer_order_item_cost_snapshots;
drop policy if exists repair_cost_revisions_cost_read on public.repair_cost_revisions;
drop policy if exists repair_cost_revision_parts_cost_read on public.repair_cost_revision_parts;
drop policy if exists "tenant members read order cost snapshots" on public.customer_order_item_cost_snapshots;
create policy "tenant members read order cost snapshots" on public.customer_order_item_cost_snapshots as PERMISSIVE for SELECT to public using (is_org_member(organization_id));
drop policy if exists "repair_cost_revisions_tenant_read" on public.repair_cost_revisions;
create policy repair_cost_revisions_tenant_read on public.repair_cost_revisions as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members membership
  WHERE ((membership.organization_id = repair_cost_revisions.organization_id) AND (membership.user_id = ( SELECT auth.uid() AS uid)) AND (membership.status = 'active'::text)))));
drop policy if exists "repair_cost_revision_parts_tenant_read" on public.repair_cost_revision_parts;
create policy repair_cost_revision_parts_tenant_read on public.repair_cost_revision_parts as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members membership
  WHERE ((membership.organization_id = repair_cost_revision_parts.organization_id) AND (membership.user_id = ( SELECT auth.uid() AS uid)) AND (membership.status = 'active'::text)))));
drop policy if exists "Org staff can read status history" on public.repair_status_history;
create policy "Org staff can read status history" on public.repair_status_history as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = repair_status_history.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.status = 'active'::text)))));
drop policy if exists "repair_images_tenant_select" on public.repair_images;
create policy repair_images_tenant_select on public.repair_images as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM (repairs r
     JOIN organization_members membership ON ((membership.organization_id = r.organization_id)))
  WHERE ((r.id = repair_images.repair_id) AND (membership.user_id = auth.uid()) AND (membership.status = 'active'::text)))));
commit;
