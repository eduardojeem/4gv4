-- SaaS customer orders for ecommerce/dashboard order management.

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_number text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  payment_status text not null default 'PENDING'
    check (payment_status in ('PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED')),
  payment_method text not null default 'CASH'
    check (payment_method in ('CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET')),
  fulfillment_type text not null default 'PICKUP'
    check (fulfillment_type in ('PICKUP', 'DELIVERY')),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_address text,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estimated_delivery_date timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  unique (organization_id, order_number)
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_order_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_orders_org_created
on public.customer_orders(organization_id, created_at desc);

create index if not exists idx_customer_orders_org_status
on public.customer_orders(organization_id, status);

create index if not exists idx_customer_orders_org_customer
on public.customer_orders(organization_id, customer_id);

create index if not exists idx_customer_orders_org_number
on public.customer_orders(organization_id, order_number);

create index if not exists idx_customer_order_items_order
on public.customer_order_items(organization_id, order_id);

create index if not exists idx_customer_order_history_order
on public.customer_order_status_history(organization_id, order_id, created_at desc);

alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.customer_order_status_history enable row level security;

drop policy if exists "tenant members can read customer orders" on public.customer_orders;
create policy "tenant members can read customer orders"
on public.customer_orders
for select
using (
  public.has_org_permission(organization_id, 'ecommerce.orders.manage')
  or (customer_id in (
    select c.id from public.customers c
    where c.profile_id = auth.uid()
      and c.organization_id = customer_orders.organization_id
  ))
);

drop policy if exists "tenant members can create customer orders" on public.customer_orders;
create policy "tenant members can create customer orders"
on public.customer_orders
for insert
with check (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));

drop policy if exists "tenant members can update customer orders" on public.customer_orders;
create policy "tenant members can update customer orders"
on public.customer_orders
for update
using (public.has_org_permission(organization_id, 'ecommerce.orders.manage'))
with check (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));

drop policy if exists "tenant members can delete customer orders" on public.customer_orders;
create policy "tenant members can delete customer orders"
on public.customer_orders
for delete
using (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));

drop policy if exists "tenant members can read customer order items" on public.customer_order_items;
create policy "tenant members can read customer order items"
on public.customer_order_items
for select
using (
  public.has_org_permission(organization_id, 'ecommerce.orders.manage')
  or exists (
    select 1
    from public.customer_orders o
    join public.customers c on c.id = o.customer_id
    where o.id = customer_order_items.order_id
      and o.organization_id = customer_order_items.organization_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "tenant members can create customer order items" on public.customer_order_items;
create policy "tenant members can create customer order items"
on public.customer_order_items
for insert
with check (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));

drop policy if exists "tenant members can update customer order items" on public.customer_order_items;
create policy "tenant members can update customer order items"
on public.customer_order_items
for update
using (public.has_org_permission(organization_id, 'ecommerce.orders.manage'))
with check (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));

drop policy if exists "tenant members can delete customer order items" on public.customer_order_items;
create policy "tenant members can delete customer order items"
on public.customer_order_items
for delete
using (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));

drop policy if exists "tenant members can read customer order history" on public.customer_order_status_history;
create policy "tenant members can read customer order history"
on public.customer_order_status_history
for select
using (
  public.has_org_permission(organization_id, 'ecommerce.orders.manage')
  or exists (
    select 1
    from public.customer_orders o
    join public.customers c on c.id = o.customer_id
    where o.id = customer_order_status_history.order_id
      and o.organization_id = customer_order_status_history.organization_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "tenant members can create customer order history" on public.customer_order_status_history;
create policy "tenant members can create customer order history"
on public.customer_order_status_history
for insert
with check (public.has_org_permission(organization_id, 'ecommerce.orders.manage'));
