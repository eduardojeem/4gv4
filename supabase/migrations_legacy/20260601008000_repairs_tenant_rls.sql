-- Phase 2: tenant-aware RLS for repairs.
-- Keep repairs_branch_scope restrictive policy if present; it adds branch access on top.

alter table public.repairs enable row level security;

drop policy if exists "repairs_insert_staff" on public.repairs;
drop policy if exists "repairs_select_unified" on public.repairs;
drop policy if exists "repairs_update_assigned_technician" on public.repairs;
drop policy if exists "repairs_delete_unified" on public.repairs;
drop policy if exists "repairs_update_unified" on public.repairs;
drop policy if exists "repairs_select_staff" on public.repairs;
drop policy if exists "repairs_insert_unified" on public.repairs;

drop policy if exists "tenant members can read repairs" on public.repairs;
create policy "tenant members can read repairs"
on public.repairs
for select
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
);

drop policy if exists "tenant members can create repairs" on public.repairs;
create policy "tenant members can create repairs"
on public.repairs
for insert
with check (
  public.has_org_permission(organization_id, 'repairs.orders.create')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
);

drop policy if exists "tenant members can update repairs" on public.repairs;
create policy "tenant members can update repairs"
on public.repairs
for update
using (
  public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
  or (
    technician_id = auth.uid()
    and public.has_org_permission(organization_id, 'repairs.orders.update')
  )
)
with check (
  public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
  or (
    technician_id = auth.uid()
    and public.has_org_permission(organization_id, 'repairs.orders.update')
  )
);

drop policy if exists "tenant members can delete repairs" on public.repairs;
create policy "tenant members can delete repairs"
on public.repairs
for delete
using (
  public.has_org_permission(organization_id, 'repairs.orders.assign')
);

-- Customer portal read access through linked customer profile, scoped to the same organization.
drop policy if exists "customers can read own repairs" on public.repairs;
create policy "customers can read own repairs"
on public.repairs
for select
using (
  exists (
    select 1
    from public.customers c
    where c.id = repairs.customer_id
      and c.organization_id = repairs.organization_id
      and c.profile_id = auth.uid()
  )
);

create index if not exists idx_repairs_org_created
on public.repairs(organization_id, created_at desc);

create index if not exists idx_repairs_org_customer
on public.repairs(organization_id, customer_id);

create index if not exists idx_repairs_org_status
on public.repairs(organization_id, status);

create index if not exists idx_repairs_org_branch
on public.repairs(organization_id, branch_id);
