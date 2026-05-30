-- Remove legacy permissive product policies that bypass tenant isolation.
-- Supabase combines permissive policies with OR, so these must not coexist
-- with organization-aware policies.

alter table public.products enable row level security;

drop policy if exists "Enable read access for all users" on public.products;
drop policy if exists "products_delete_authenticated" on public.products;
drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;

-- Defensive cleanup for common policy names used by earlier migrations.
drop policy if exists "Allow authenticated read access" on public.products;
drop policy if exists "Allow authenticated insert access" on public.products;
drop policy if exists "Allow authenticated update access" on public.products;
drop policy if exists "Allow authenticated delete access" on public.products;
drop policy if exists "Authenticated users can read products" on public.products;
drop policy if exists "Authenticated users can insert products" on public.products;
drop policy if exists "Authenticated users can update products" on public.products;
drop policy if exists "Authenticated users can delete products" on public.products;
