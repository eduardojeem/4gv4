-- Normalize branch defaults and preserve access for existing operational staff.

begin;

update public.branches
set is_default = false,
    updated_at = now()
where is_default = true
  and is_active = false;

with organizations_without_default as (
  select organization_id
  from public.branches
  where organization_id is not null
    and is_active = true
  group by organization_id
  having not bool_or(is_default)
), preferred_branch as (
  select distinct on (branch.organization_id)
    branch.id,
    branch.organization_id
  from public.branches branch
  join organizations_without_default missing
    on missing.organization_id = branch.organization_id
  where branch.is_active = true
  order by branch.organization_id, branch.created_at asc, branch.id asc
)
update public.branches branch
set is_default = true,
    updated_at = now()
from preferred_branch preferred
where branch.id = preferred.id;

insert into public.user_branch_assignments (
  user_id,
  branch_id,
  organization_id,
  is_primary,
  is_active,
  assigned_by,
  created_at,
  updated_at
)
select
  membership.user_id,
  default_branch.id,
  membership.organization_id,
  true,
  true,
  membership.user_id,
  now(),
  now()
from public.organization_members membership
join lateral (
  select branch.id
  from public.branches branch
  where branch.organization_id = membership.organization_id
    and branch.is_active = true
  order by branch.is_default desc, branch.created_at asc, branch.id asc
  limit 1
) default_branch on true
where membership.status = 'active'
  and membership.role in ('manager', 'cashier', 'technician', 'seller')
  and not exists (
    select 1
    from public.user_branch_assignments assignment
    where assignment.user_id = membership.user_id
      and assignment.organization_id = membership.organization_id
      and assignment.is_active = true
  )
on conflict (user_id, branch_id) do update
set organization_id = excluded.organization_id,
    is_primary = true,
    is_active = true,
    updated_at = now();

create or replace function public.get_primary_branch_id(user_uuid uuid default auth.uid())
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select assignment.branch_id
  from public.user_branch_assignments assignment
  join public.branches branch on branch.id = assignment.branch_id
  where assignment.user_id = user_uuid
    and assignment.is_active = true
    and branch.is_active = true
  order by assignment.is_primary desc, assignment.updated_at desc, assignment.created_at asc
  limit 1;
$$;

revoke all on function public.get_primary_branch_id(uuid) from public, anon, authenticated;
grant execute on function public.get_primary_branch_id(uuid) to service_role;

commit;
