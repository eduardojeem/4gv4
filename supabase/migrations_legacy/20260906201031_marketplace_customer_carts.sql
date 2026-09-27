begin;

create table if not exists public.customer_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create table if not exists public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 999),
  observed_unit_price numeric(14,2) not null check (observed_unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_cart_items_identity_idx
  on public.customer_cart_items (
    cart_id,
    product_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.marketplace_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  order_notifications boolean not null default true,
  repair_notifications boolean not null default true,
  credit_notifications boolean not null default true,
  promotions boolean not null default false,
  marketing_communications boolean not null default false,
  public_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_carts_user_id_idx on public.customer_carts(user_id);
create index if not exists customer_carts_organization_id_idx on public.customer_carts(organization_id);
create index if not exists customer_cart_items_cart_id_idx on public.customer_cart_items(cart_id);

alter table public.customer_carts enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.marketplace_user_preferences enable row level security;

revoke all on public.customer_carts from anon;
revoke all on public.customer_cart_items from anon;
revoke all on public.marketplace_user_preferences from anon;
grant select, insert, update, delete on public.customer_carts to authenticated;
grant select, insert, update, delete on public.customer_cart_items to authenticated;
grant select, insert, update, delete on public.marketplace_user_preferences to authenticated;

drop policy if exists customer_carts_select_own on public.customer_carts;
create policy customer_carts_select_own on public.customer_carts for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists customer_carts_insert_own on public.customer_carts;
create policy customer_carts_insert_own on public.customer_carts for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists customer_carts_update_own on public.customer_carts;
create policy customer_carts_update_own on public.customer_carts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists customer_carts_delete_own on public.customer_carts;
create policy customer_carts_delete_own on public.customer_carts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists customer_cart_items_select_own on public.customer_cart_items;
create policy customer_cart_items_select_own on public.customer_cart_items for select to authenticated
  using (exists (select 1 from public.customer_carts c where c.id = cart_id and c.user_id = (select auth.uid())));
drop policy if exists customer_cart_items_insert_own on public.customer_cart_items;
create policy customer_cart_items_insert_own on public.customer_cart_items for insert to authenticated
  with check (exists (select 1 from public.customer_carts c where c.id = cart_id and c.user_id = (select auth.uid())));
drop policy if exists customer_cart_items_update_own on public.customer_cart_items;
create policy customer_cart_items_update_own on public.customer_cart_items for update to authenticated
  using (exists (select 1 from public.customer_carts c where c.id = cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.customer_carts c where c.id = cart_id and c.user_id = (select auth.uid())));
drop policy if exists customer_cart_items_delete_own on public.customer_cart_items;
create policy customer_cart_items_delete_own on public.customer_cart_items for delete to authenticated
  using (exists (select 1 from public.customer_carts c where c.id = cart_id and c.user_id = (select auth.uid())));

drop policy if exists marketplace_preferences_select_own on public.marketplace_user_preferences;
create policy marketplace_preferences_select_own on public.marketplace_user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists marketplace_preferences_insert_own on public.marketplace_user_preferences;
create policy marketplace_preferences_insert_own on public.marketplace_user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists marketplace_preferences_update_own on public.marketplace_user_preferences;
create policy marketplace_preferences_update_own on public.marketplace_user_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists marketplace_preferences_delete_own on public.marketplace_user_preferences;
create policy marketplace_preferences_delete_own on public.marketplace_user_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.customer_carts is 'Carritos persistentes de compradores autenticados, separados por organización.';
comment on table public.customer_cart_items is 'Ítems observados del carrito; precio y stock se revalidan antes de vender.';
comment on table public.marketplace_user_preferences is 'Preferencias personales del comprador en Marketplace.';

commit;
