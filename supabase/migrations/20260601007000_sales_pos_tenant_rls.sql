-- Phase 2: tenant-aware RLS for POS sales, sale items and payments.
-- Run only after organization_id has been backfilled for sales, sale_items and payments.

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;

-- Drop legacy role-only sales policies.
drop policy if exists "sales_delete_admin" on public.sales;
drop policy if exists "sales_insert_consolidated" on public.sales;
drop policy if exists "sales_select_consolidated" on public.sales;
drop policy if exists "sales_update_staff" on public.sales;
drop policy if exists "sales_select_unified" on public.sales;
drop policy if exists "sales_insert_unified" on public.sales;
drop policy if exists "sales_update_unified" on public.sales;
drop policy if exists "sales_delete_unified" on public.sales;

-- Keep sales_branch_scope restrictive policy if present; it adds branch scoping on top of tenant scoping.

drop policy if exists "tenant members can read sales" on public.sales;
create policy "tenant members can read sales"
on public.sales
for select
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
  or public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can create sales" on public.sales;
create policy "tenant members can create sales"
on public.sales
for insert
with check (
  public.has_org_permission(organization_id, 'pos.sales.create')
);

drop policy if exists "tenant members can update sales" on public.sales;
create policy "tenant members can update sales"
on public.sales
for update
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
)
with check (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can delete sales" on public.sales;
create policy "tenant members can delete sales"
on public.sales
for delete
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

-- Sale items.
drop policy if exists "sale_items_delete_unified" on public.sale_items;
drop policy if exists "sale_items_insert_unified" on public.sale_items;
drop policy if exists "sale_items_select_unified" on public.sale_items;
drop policy if exists "sale_items_update_unified" on public.sale_items;

drop policy if exists "tenant members can read sale items" on public.sale_items;
create policy "tenant members can read sale items"
on public.sale_items
for select
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
  or public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can create sale items" on public.sale_items;
create policy "tenant members can create sale items"
on public.sale_items
for insert
with check (
  public.has_org_permission(organization_id, 'pos.sales.create')
  and exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.organization_id = sale_items.organization_id
  )
);

drop policy if exists "tenant members can update sale items" on public.sale_items;
create policy "tenant members can update sale items"
on public.sale_items
for update
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
)
with check (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can delete sale items" on public.sale_items;
create policy "tenant members can delete sale items"
on public.sale_items
for delete
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

-- Payments.
drop policy if exists "payments_delete_unified" on public.payments;
drop policy if exists "payments_insert_unified" on public.payments;
drop policy if exists "payments_select_unified" on public.payments;
drop policy if exists "payments_update_unified" on public.payments;

drop policy if exists "tenant members can read payments" on public.payments;
create policy "tenant members can read payments"
on public.payments
for select
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
  or public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can create payments" on public.payments;
create policy "tenant members can create payments"
on public.payments
for insert
with check (
  public.has_org_permission(organization_id, 'pos.sales.create')
);

drop policy if exists "tenant members can update payments" on public.payments;
create policy "tenant members can update payments"
on public.payments
for update
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
)
with check (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can delete payments" on public.payments;
create policy "tenant members can delete payments"
on public.payments
for delete
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

create index if not exists idx_sales_org_created
on public.sales(organization_id, created_at desc);

create index if not exists idx_sales_org_customer
on public.sales(organization_id, customer_id);

create index if not exists idx_sale_items_org_sale
on public.sale_items(organization_id, sale_id);

create index if not exists idx_sale_items_org_product
on public.sale_items(organization_id, product_id);

create index if not exists idx_payments_org_sale
on public.payments(organization_id, sale_id);
