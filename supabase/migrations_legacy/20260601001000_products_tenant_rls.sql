-- Phase 2 pilot: tenant-aware RLS for private products access.
-- Run after verifying all products have organization_id and every staff user is an active organization member.

alter table public.products enable row level security;

drop policy if exists "Users can view products based on role" on public.products;
drop policy if exists "Users can insert products based on role" on public.products;
drop policy if exists "Users can update products based on role" on public.products;
drop policy if exists "Users can delete products based on role" on public.products;
drop policy if exists "products_select_policy" on public.products;
drop policy if exists "products_insert_policy" on public.products;
drop policy if exists "products_update_policy" on public.products;
drop policy if exists "products_delete_policy" on public.products;
drop policy if exists "authenticated users can view products" on public.products;
drop policy if exists "authenticated users can insert products" on public.products;
drop policy if exists "authenticated users can update products" on public.products;
drop policy if exists "authenticated users can delete products" on public.products;
drop policy if exists "public can read active products" on public.products;

create policy "tenant members can read products"
on public.products
for select
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
);

create policy "tenant members can create products"
on public.products
for insert
with check (
  public.has_org_permission(organization_id, 'inventory.products.create')
);

create policy "tenant members can update products"
on public.products
for update
using (
  public.has_org_permission(organization_id, 'inventory.products.update')
)
with check (
  public.has_org_permission(organization_id, 'inventory.products.update')
);

create policy "tenant members can delete products"
on public.products
for delete
using (
  public.has_org_permission(organization_id, 'inventory.products.delete')
);

-- Keep public marketplace reads explicit and narrow.
-- Adjust visible_in_store/is_public column names if your production schema differs.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'visible_in_store'
  ) then
    execute $policy$
      create policy "public can read visible active products"
      on public.products
      for select
      using (
        is_active = true
        and visible_in_store = true
      )
    $policy$;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'is_public'
  ) then
    execute $policy$
      create policy "public can read public active products"
      on public.products
      for select
      using (
        is_active = true
        and is_public = true
      )
    $policy$;
  end if;
end $$;

create index if not exists idx_products_org_active_name
on public.products(organization_id, is_active, name);

create index if not exists idx_products_org_category
on public.products(organization_id, category_id);

create index if not exists idx_products_org_sku
on public.products(organization_id, sku);
