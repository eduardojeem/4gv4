-- Remove legacy permissive policies whose global permission branches can
-- bypass organization scoping. Tenant-aware replacements already exist for
-- every affected command and remain untouched below.

begin;

drop policy if exists "products_delete_policy" on public.products;
drop policy if exists "products_insert_policy" on public.products;
drop policy if exists "products_update_policy" on public.products;

drop policy if exists "Admins can manage website settings" on public.website_settings;

commit;
