-- Performance Advisor: 17 politicas RLS que reevaluaban auth.*() por fila, y
-- 5 indices duplicados.
--
-- Las 17 politicas se reescriben tal cual estaban -mismo texto, mismos roles,
-- mismo comando- envolviendo unicamente las llamadas a auth.uid()/auth.role()
-- en (select ...), que es el patron que documenta Supabase para que Postgres
-- las evalue una vez por consulta en vez de una vez por fila. Ningun chequeo
-- de permiso cambia.
--
-- Los 5 indices son duplicados exactos -mismas columnas, mismo tipo- creados
-- por dos migraciones que resolvieron lo mismo sin saber una de la otra
-- (modulos "finance_" y "payroll_"). Ninguno esta referenciado por nombre en
-- ON CONFLICT ni en el codigo de la app.

begin;

-- ---------------------------------------------------------------------------
-- system_settings
-- ---------------------------------------------------------------------------

drop policy if exists "Super admins can insert system settings" on public.system_settings;
create policy "Super admins can insert system settings"
on public.system_settings
for insert
to authenticated
with check (
  exists (
    select 1 from user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and ur.role = 'super_admin'
  )
  or exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
  )
);

drop policy if exists "Super admins can update system settings" on public.system_settings;
create policy "Super admins can update system settings"
on public.system_settings
for update
to authenticated
using (
  exists (
    select 1 from user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and ur.role = 'super_admin'
  )
  or exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and ur.role = 'super_admin'
  )
  or exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
  )
);

-- ---------------------------------------------------------------------------
-- branch_inventory
-- ---------------------------------------------------------------------------

drop policy if exists "branch_inventory_delete_org_permission" on public.branch_inventory;
create policy "branch_inventory_delete_org_permission"
on public.branch_inventory
for delete
to authenticated
using (
  get_user_role((select auth.uid())) = 'super_admin'
  or exists (
    select 1 from branches b
    where b.id = branch_inventory.branch_id
      and (
        has_org_permission(b.organization_id, 'inventory.products.update')
        or has_org_permission(b.organization_id, 'inventory.stock.manage')
      )
  )
);

drop policy if exists "branch_inventory_insert_org_permission" on public.branch_inventory;
create policy "branch_inventory_insert_org_permission"
on public.branch_inventory
for insert
to authenticated
with check (
  get_user_role((select auth.uid())) = 'super_admin'
  or exists (
    select 1 from branches b
    where b.id = branch_inventory.branch_id
      and (
        has_org_permission(b.organization_id, 'inventory.products.create')
        or has_org_permission(b.organization_id, 'inventory.stock.manage')
      )
  )
);

drop policy if exists "branch_inventory_select_org_permission" on public.branch_inventory;
create policy "branch_inventory_select_org_permission"
on public.branch_inventory
for select
to authenticated
using (
  get_user_role((select auth.uid())) = 'super_admin'
  or exists (
    select 1 from branches b
    where b.id = branch_inventory.branch_id
      and has_org_permission(b.organization_id, 'inventory.products.read')
  )
);

drop policy if exists "branch_inventory_update_org_permission" on public.branch_inventory;
create policy "branch_inventory_update_org_permission"
on public.branch_inventory
for update
to authenticated
using (
  get_user_role((select auth.uid())) = 'super_admin'
  or exists (
    select 1 from branches b
    where b.id = branch_inventory.branch_id
      and (
        has_org_permission(b.organization_id, 'inventory.products.update')
        or has_org_permission(b.organization_id, 'inventory.stock.manage')
      )
  )
)
with check (
  get_user_role((select auth.uid())) = 'super_admin'
  or exists (
    select 1 from branches b
    where b.id = branch_inventory.branch_id
      and (
        has_org_permission(b.organization_id, 'inventory.products.update')
        or has_org_permission(b.organization_id, 'inventory.stock.manage')
      )
  )
);

-- ---------------------------------------------------------------------------
-- global_brands
-- ---------------------------------------------------------------------------

drop policy if exists "global_brands_read" on public.global_brands;
create policy "global_brands_read"
on public.global_brands
for select
to public
using ((select auth.role()) = 'authenticated');

-- ---------------------------------------------------------------------------
-- global_notification_reads
-- ---------------------------------------------------------------------------

drop policy if exists "own_reads_select" on public.global_notification_reads;
create policy "own_reads_select"
on public.global_notification_reads
for select
to public
using ((select auth.uid()) = user_id);

drop policy if exists "own_reads_update" on public.global_notification_reads;
create policy "own_reads_update"
on public.global_notification_reads
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "own_reads_upsert" on public.global_notification_reads;
create policy "own_reads_upsert"
on public.global_notification_reads
for insert
to public
with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- global_notifications
-- ---------------------------------------------------------------------------

drop policy if exists "superadmin_full_access" on public.global_notifications;
create policy "superadmin_full_access"
on public.global_notifications
for all
to public
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

drop policy if exists "products_delete_policy" on public.products;
create policy "products_delete_policy"
on public.products
for delete
to authenticated
using (
  has_permission('products.delete')
  or has_permission('inventory.products.delete')
  or exists (
    select 1 from organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = products.organization_id
      and om.role = any (array['owner'::organization_role, 'admin'::organization_role])
      and om.status = 'active'
  )
);

drop policy if exists "products_insert_policy" on public.products;
create policy "products_insert_policy"
on public.products
for insert
to authenticated
with check (
  has_permission('products.create')
  or has_permission('inventory.products.create')
  or exists (
    select 1 from organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = products.organization_id
      and om.role = any (array['owner'::organization_role, 'admin'::organization_role, 'manager'::organization_role])
      and om.status = 'active'
  )
);

drop policy if exists "products_update_policy" on public.products;
create policy "products_update_policy"
on public.products
for update
to authenticated
using (
  has_permission('products.update')
  or has_permission('inventory.products.update')
  or exists (
    select 1 from organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = products.organization_id
      and om.role = any (array['owner'::organization_role, 'admin'::organization_role, 'manager'::organization_role])
      and om.status = 'active'
  )
)
with check (
  has_permission('products.update')
  or has_permission('inventory.products.update')
  or exists (
    select 1 from organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = products.organization_id
      and om.role = any (array['owner'::organization_role, 'admin'::organization_role, 'manager'::organization_role])
      and om.status = 'active'
  )
);

-- ---------------------------------------------------------------------------
-- repair_status_history
-- ---------------------------------------------------------------------------

drop policy if exists "Org staff can insert status history" on public.repair_status_history;
create policy "Org staff can insert status history"
on public.repair_status_history
for insert
to public
with check (
  exists (
    select 1 from organization_members om
    where om.organization_id = repair_status_history.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists "Org staff can read status history" on public.repair_status_history;
create policy "Org staff can read status history"
on public.repair_status_history
for select
to public
using (
  exists (
    select 1 from organization_members om
    where om.organization_id = repair_status_history.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

-- ---------------------------------------------------------------------------
-- website_settings
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can manage website settings" on public.website_settings;
create policy "Admins can manage website settings"
on public.website_settings
for all
to public
using (
  exists (
    select 1 from profiles
    where profiles.id = (select auth.uid())
      and (profiles.role = 'admin' or profiles.role = 'super_admin')
  )
  or exists (
    select 1 from user_roles
    where user_roles.user_id = (select auth.uid())
      and user_roles.role = any (array['admin'::text, 'super_admin'::text])
      and user_roles.is_active = true
  )
);

-- ---------------------------------------------------------------------------
-- Indices duplicados: se conserva uno de cada par.
-- ---------------------------------------------------------------------------

drop index if exists public.payroll_branches_organization_id_id_unique;
drop index if exists public.payroll_cash_closures_scope_id_unique;
drop index if exists public.idx_customers_search_name_trgm;
-- Se conserva el constraint con nombre (organization_members_organization_id_user_id_key)
-- sobre el indice suelto: un constraint documenta la intencion de unicidad,
-- un indice plano no.
drop index if exists public.payroll_organization_members_scope_unique;
drop index if exists public.idx_website_settings_org_key_unique;

commit;
