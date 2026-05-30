-- Remove legacy categories policies that bypass tenant isolation.
-- Permissive policies are OR-ed by PostgreSQL, so "categories_select_unified"
-- with qual=true exposes categories across organizations.

alter table public.categories enable row level security;

drop policy if exists "categories_select_unified" on public.categories;
drop policy if exists "categories_insert_unified" on public.categories;
drop policy if exists "categories_update_unified" on public.categories;
drop policy if exists "categories_delete_unified" on public.categories;
