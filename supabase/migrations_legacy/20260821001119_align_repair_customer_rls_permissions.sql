-- The repair customer endpoint authorizes repair-order permissions. Keep the
-- database boundary aligned so technicians can use the customer picker without
-- receiving an RLS error after the API has already authorized the operation.

drop policy if exists "repair staff can read customers" on public.customers;
create policy "repair staff can read customers"
on public.customers
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.create')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
);

drop policy if exists "repair staff can create customers" on public.customers;
create policy "repair staff can create customers"
on public.customers
for insert
to authenticated
with check (
  public.has_org_permission(organization_id, 'repairs.orders.create')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
);

drop policy if exists "repair staff can update customers" on public.customers;
create policy "repair staff can update customers"
on public.customers
for update
to authenticated
using (
  public.has_org_permission(organization_id, 'repairs.orders.update')
)
with check (
  public.has_org_permission(organization_id, 'repairs.orders.update')
);
