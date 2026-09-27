-- Phase 2: tenant-aware RLS for customers.

alter table public.customers enable row level security;

drop policy if exists "authenticated_select_customers" on public.customers;
drop policy if exists "customers_select_unified" on public.customers;
drop policy if exists "customers_insert_unified" on public.customers;
drop policy if exists "customers_update_unified" on public.customers;
drop policy if exists "customers_delete_unified" on public.customers;
drop policy if exists "Enable read access for authenticated users" on public.customers;
drop policy if exists "Enable read access for all users" on public.customers;
drop policy if exists "Authenticated users can read customers" on public.customers;
drop policy if exists "Authenticated users can insert customers" on public.customers;
drop policy if exists "Authenticated users can update customers" on public.customers;
drop policy if exists "Authenticated users can delete customers" on public.customers;

drop policy if exists "tenant members can read customers" on public.customers;
create policy "tenant members can read customers"
on public.customers
for select
using (
  public.has_org_permission(organization_id, 'crm.customers.read')
  or public.has_org_permission(organization_id, 'crm.customers.manage')
);

drop policy if exists "tenant members can create customers" on public.customers;
create policy "tenant members can create customers"
on public.customers
for insert
with check (
  public.has_org_permission(organization_id, 'crm.customers.manage')
);

drop policy if exists "tenant members can update customers" on public.customers;
create policy "tenant members can update customers"
on public.customers
for update
using (
  public.has_org_permission(organization_id, 'crm.customers.manage')
)
with check (
  public.has_org_permission(organization_id, 'crm.customers.manage')
);

drop policy if exists "tenant members can delete customers" on public.customers;
create policy "tenant members can delete customers"
on public.customers
for delete
using (
  public.has_org_permission(organization_id, 'crm.customers.manage')
);

-- Customer portal self-access, scoped to the customer's own profile and tenant row.
drop policy if exists "customers can read own customer profile" on public.customers;
create policy "customers can read own customer profile"
on public.customers
for select
using (
  profile_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "customers can update own customer profile" on public.customers;
create policy "customers can update own customer profile"
on public.customers
for update
using (
  profile_id = auth.uid()
  and public.is_org_member(organization_id)
)
with check (
  profile_id = auth.uid()
  and public.is_org_member(organization_id)
);

create index if not exists idx_customers_org_created
on public.customers(organization_id, created_at desc);

create index if not exists idx_customers_org_status
on public.customers(organization_id, status);

create index if not exists idx_customers_org_phone
on public.customers(organization_id, phone);

create index if not exists idx_customers_org_email
on public.customers(organization_id, email);
