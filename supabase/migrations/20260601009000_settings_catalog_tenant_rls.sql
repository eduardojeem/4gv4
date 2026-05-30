-- Phase 2: tenant-aware RLS for tenant settings/catalog/supporting tables.
-- Tables covered here already have organization_id.
-- system_settings is intentionally not changed here because it does not have organization_id
-- in the current schema snapshot and should be treated as platform-level config.

alter table public.branches enable row level security;
alter table public.brands enable row level security;
alter table public.communication_messages enable row level security;
alter table public.promotions enable row level security;
alter table public.suppliers enable row level security;
alter table public.website_settings enable row level security;

-- Branches
drop policy if exists "branches_delete_unified" on public.branches;
drop policy if exists "branches_insert_unified" on public.branches;
drop policy if exists "branches_select_unified" on public.branches;
drop policy if exists "branches_update_unified" on public.branches;

drop policy if exists "tenant members can read branches" on public.branches;
create policy "tenant members can read branches"
on public.branches
for select
using (
  public.is_org_member(organization_id)
);

drop policy if exists "tenant admins can create branches" on public.branches;
create policy "tenant admins can create branches"
on public.branches
for insert
with check (
  public.has_org_permission(organization_id, 'settings.manage')
);

drop policy if exists "tenant admins can update branches" on public.branches;
create policy "tenant admins can update branches"
on public.branches
for update
using (
  public.has_org_permission(organization_id, 'settings.manage')
)
with check (
  public.has_org_permission(organization_id, 'settings.manage')
);

drop policy if exists "tenant admins can delete branches" on public.branches;
create policy "tenant admins can delete branches"
on public.branches
for delete
using (
  public.has_org_permission(organization_id, 'settings.manage')
);

-- Brands
drop policy if exists "brands_delete_consolidated" on public.brands;
drop policy if exists "brands_insert_consolidated" on public.brands;
drop policy if exists "brands_select_consolidated" on public.brands;
drop policy if exists "brands_update_consolidated" on public.brands;

drop policy if exists "tenant members can read brands" on public.brands;
create policy "tenant members can read brands"
on public.brands
for select
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
);

drop policy if exists "tenant members can create brands" on public.brands;
create policy "tenant members can create brands"
on public.brands
for insert
with check (
  public.has_org_permission(organization_id, 'inventory.products.create')
);

drop policy if exists "tenant members can update brands" on public.brands;
create policy "tenant members can update brands"
on public.brands
for update
using (
  public.has_org_permission(organization_id, 'inventory.products.update')
)
with check (
  public.has_org_permission(organization_id, 'inventory.products.update')
);

drop policy if exists "tenant members can delete brands" on public.brands;
create policy "tenant members can delete brands"
on public.brands
for delete
using (
  public.has_org_permission(organization_id, 'inventory.products.delete')
);

-- Suppliers
drop policy if exists "Public can read suppliers" on public.suppliers;
drop policy if exists "suppliers_delete_admin" on public.suppliers;
drop policy if exists "suppliers_insert_admin_manager" on public.suppliers;
drop policy if exists "suppliers_update_admin_manager" on public.suppliers;

drop policy if exists "tenant members can read suppliers" on public.suppliers;
create policy "tenant members can read suppliers"
on public.suppliers
for select
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
);

drop policy if exists "tenant members can create suppliers" on public.suppliers;
create policy "tenant members can create suppliers"
on public.suppliers
for insert
with check (
  public.has_org_permission(organization_id, 'inventory.products.create')
);

drop policy if exists "tenant members can update suppliers" on public.suppliers;
create policy "tenant members can update suppliers"
on public.suppliers
for update
using (
  public.has_org_permission(organization_id, 'inventory.products.update')
)
with check (
  public.has_org_permission(organization_id, 'inventory.products.update')
);

drop policy if exists "tenant members can delete suppliers" on public.suppliers;
create policy "tenant members can delete suppliers"
on public.suppliers
for delete
using (
  public.has_org_permission(organization_id, 'inventory.products.delete')
);

-- Promotions
drop policy if exists "promotions_delete_admin" on public.promotions;
drop policy if exists "promotions_insert_staff" on public.promotions;
drop policy if exists "promotions_select_authenticated" on public.promotions;
drop policy if exists "promotions_update_staff" on public.promotions;

drop policy if exists "tenant members can read promotions" on public.promotions;
create policy "tenant members can read promotions"
on public.promotions
for select
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
);

drop policy if exists "tenant members can create promotions" on public.promotions;
create policy "tenant members can create promotions"
on public.promotions
for insert
with check (
  public.has_org_permission(organization_id, 'inventory.products.create')
);

drop policy if exists "tenant members can update promotions" on public.promotions;
create policy "tenant members can update promotions"
on public.promotions
for update
using (
  public.has_org_permission(organization_id, 'inventory.products.update')
)
with check (
  public.has_org_permission(organization_id, 'inventory.products.update')
);

drop policy if exists "tenant members can delete promotions" on public.promotions;
create policy "tenant members can delete promotions"
on public.promotions
for delete
using (
  public.has_org_permission(organization_id, 'inventory.products.delete')
);

-- Communication messages
drop policy if exists "communication_messages_delete_unified" on public.communication_messages;
drop policy if exists "communication_messages_insert_unified" on public.communication_messages;
drop policy if exists "communication_messages_select_unified" on public.communication_messages;
drop policy if exists "communication_messages_update_unified" on public.communication_messages;

drop policy if exists "tenant members can read communication messages" on public.communication_messages;
create policy "tenant members can read communication messages"
on public.communication_messages
for select
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
);

drop policy if exists "tenant members can create communication messages" on public.communication_messages;
create policy "tenant members can create communication messages"
on public.communication_messages
for insert
with check (
  (
    public.has_org_permission(organization_id, 'repairs.orders.update')
    or public.has_org_permission(organization_id, 'repairs.orders.assign')
  )
  and (
    repair_id is null
    or exists (
      select 1
      from public.repairs r
      where r.id = communication_messages.repair_id
        and r.organization_id = communication_messages.organization_id
    )
  )
);

drop policy if exists "tenant members can update communication messages" on public.communication_messages;
create policy "tenant members can update communication messages"
on public.communication_messages
for update
using (
  public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
)
with check (
  public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
);

drop policy if exists "tenant members can delete communication messages" on public.communication_messages;
create policy "tenant members can delete communication messages"
on public.communication_messages
for delete
using (
  public.has_org_permission(organization_id, 'repairs.orders.assign')
);

-- Website settings
drop policy if exists "website_settings_admin_delete" on public.website_settings;
drop policy if exists "website_settings_insert_unified" on public.website_settings;
drop policy if exists "website_settings_select_admin_only" on public.website_settings;
drop policy if exists "website_settings_update_unified" on public.website_settings;

drop policy if exists "tenant members can read website settings" on public.website_settings;
create policy "tenant members can read website settings"
on public.website_settings
for select
using (
  public.has_org_permission(organization_id, 'settings.read')
  or public.has_org_permission(organization_id, 'settings.manage')
);

drop policy if exists "tenant admins can create website settings" on public.website_settings;
create policy "tenant admins can create website settings"
on public.website_settings
for insert
with check (
  public.has_org_permission(organization_id, 'settings.manage')
);

drop policy if exists "tenant admins can update website settings" on public.website_settings;
create policy "tenant admins can update website settings"
on public.website_settings
for update
using (
  public.has_org_permission(organization_id, 'settings.manage')
)
with check (
  public.has_org_permission(organization_id, 'settings.manage')
);

drop policy if exists "tenant admins can delete website settings" on public.website_settings;
create policy "tenant admins can delete website settings"
on public.website_settings
for delete
using (
  public.has_org_permission(organization_id, 'settings.manage')
);

create index if not exists idx_branches_org_active
on public.branches(organization_id, is_active);

create index if not exists idx_brands_org_name
on public.brands(organization_id, name);

create index if not exists idx_suppliers_org_name
on public.suppliers(organization_id, name);

create index if not exists idx_promotions_org_active
on public.promotions(organization_id, is_active);

create index if not exists idx_communication_messages_org_repair
on public.communication_messages(organization_id, repair_id);

create index if not exists idx_website_settings_org
on public.website_settings(organization_id);
