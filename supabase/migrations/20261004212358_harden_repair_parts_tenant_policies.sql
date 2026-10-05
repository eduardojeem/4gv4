-- repair_parts does not carry organization_id directly. Every policy must
-- therefore authorize through its parent repair, otherwise a role check alone
-- exposes rows from every tenant through the Data API.

revoke all on table public.repair_parts from anon;
revoke insert, update, delete on table public.repair_parts from authenticated;
grant select on table public.repair_parts to authenticated;

drop policy if exists "repair_parts_delete_unified" on public.repair_parts;
drop policy if exists "repair_parts_insert_unified" on public.repair_parts;
drop policy if exists "repair_parts_select_unified" on public.repair_parts;
drop policy if exists "repair_parts_update_unified" on public.repair_parts;
drop policy if exists "repair_parts_select_tenant" on public.repair_parts;
drop policy if exists "repair_parts_insert_tenant" on public.repair_parts;
drop policy if exists "repair_parts_update_tenant" on public.repair_parts;
drop policy if exists "repair_parts_delete_tenant" on public.repair_parts;

create policy "repair_parts_select_tenant"
on public.repair_parts
for select
to authenticated
using (
  exists (
    select 1
    from public.repairs repair
    where repair.id = repair_parts.repair_id
      and public.has_org_permission(repair.organization_id, 'repairs.orders.read')
      and public.user_has_branch_access(repair.branch_id)
  )
);

create policy "repair_parts_insert_tenant"
on public.repair_parts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.repairs repair
    where repair.id = repair_parts.repair_id
      and public.has_org_permission(repair.organization_id, 'repairs.orders.update')
      and public.user_has_branch_access(repair.branch_id)
  )
);

create policy "repair_parts_update_tenant"
on public.repair_parts
for update
to authenticated
using (
  exists (
    select 1
    from public.repairs repair
    where repair.id = repair_parts.repair_id
      and public.has_org_permission(repair.organization_id, 'repairs.orders.update')
      and public.user_has_branch_access(repair.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.repairs repair
    where repair.id = repair_parts.repair_id
      and public.has_org_permission(repair.organization_id, 'repairs.orders.update')
      and public.user_has_branch_access(repair.branch_id)
  )
);

create policy "repair_parts_delete_tenant"
on public.repair_parts
for delete
to authenticated
using (
  exists (
    select 1
    from public.repairs repair
    where repair.id = repair_parts.repair_id
      and public.has_org_permission(repair.organization_id, 'repairs.orders.update')
      and public.user_has_branch_access(repair.branch_id)
  )
);
