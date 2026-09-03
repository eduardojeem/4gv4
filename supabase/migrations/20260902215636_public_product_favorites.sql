create table public.public_product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  store_slug text not null check (store_slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  product_name text not null check (length(product_name) between 1 and 250),
  store_name text not null check (length(store_name) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, store_slug, product_id)
);
-- References survive stock changes and catalog removal; no private product data is joined.
alter table public.public_product_favorites enable row level security;
revoke all on public.public_product_favorites from anon, authenticated;
grant select, insert, update, delete on public.public_product_favorites to authenticated;
create policy favorites_owner_select on public.public_product_favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy favorites_owner_insert on public.public_product_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy favorites_owner_update on public.public_product_favorites for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy favorites_owner_delete on public.public_product_favorites for delete to authenticated using ((select auth.uid()) = user_id);
