-- Phase 2: tenant-aware RLS for categories.

alter table public.categories enable row level security;

drop policy if exists "Enable read access for all users" on public.categories;
drop policy if exists "categories_select_authenticated" on public.categories;
drop policy if exists "categories_insert_authenticated" on public.categories;
drop policy if exists "categories_update_authenticated" on public.categories;
drop policy if exists "categories_delete_authenticated" on public.categories;
drop policy if exists "Authenticated users can read categories" on public.categories;
drop policy if exists "Authenticated users can insert categories" on public.categories;
drop policy if exists "Authenticated users can update categories" on public.categories;
drop policy if exists "Authenticated users can delete categories" on public.categories;
drop policy if exists "Users can view categories" on public.categories;
drop policy if exists "Users can create categories" on public.categories;
drop policy if exists "Users can update categories" on public.categories;
drop policy if exists "Users can delete categories" on public.categories;

drop policy if exists "tenant members can read categories" on public.categories;
create policy "tenant members can read categories"
on public.categories
for select
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
);

drop policy if exists "tenant members can create categories" on public.categories;
create policy "tenant members can create categories"
on public.categories
for insert
with check (
  public.has_org_permission(organization_id, 'inventory.products.create')
);

drop policy if exists "tenant members can update categories" on public.categories;
create policy "tenant members can update categories"
on public.categories
for update
using (
  public.has_org_permission(organization_id, 'inventory.products.update')
)
with check (
  public.has_org_permission(organization_id, 'inventory.products.update')
);

drop policy if exists "tenant members can delete categories" on public.categories;
create policy "tenant members can delete categories"
on public.categories
for delete
using (
  public.has_org_permission(organization_id, 'inventory.products.delete')
);

create index if not exists idx_categories_org_active_name
on public.categories(organization_id, is_active, name);

create index if not exists idx_categories_org_parent
on public.categories(organization_id, parent_id);
