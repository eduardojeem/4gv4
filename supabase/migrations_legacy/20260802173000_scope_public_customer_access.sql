-- Scope customer-facing permissions and repair ownership by organization.

alter table public.user_permissions
  add column if not exists organization_id uuid
  references public.organizations(id) on delete cascade;

create index if not exists idx_user_permissions_org_user_permission
  on public.user_permissions(organization_id, user_id, permission, is_active);

-- Legacy wholesale grants had no tenant provenance. Preserve access only in
-- organizations where the account is already an active linked customer.
insert into public.user_permissions (
  user_id,
  organization_id,
  permission,
  granted_by,
  granted_at,
  expires_at,
  is_active,
  created_at
)
select distinct on (
  permission_row.user_id,
  customer.organization_id,
  permission_row.permission
)
  permission_row.user_id,
  customer.organization_id,
  permission_row.permission,
  permission_row.granted_by,
  permission_row.granted_at,
  permission_row.expires_at,
  true,
  coalesce(permission_row.created_at, now())
from public.user_permissions permission_row
join public.customers customer
  on customer.profile_id = permission_row.user_id
 and customer.organization_id is not null
join public.organization_members membership
  on membership.user_id = permission_row.user_id
 and membership.organization_id = customer.organization_id
 and membership.status = 'active'
where permission_row.permission = 'products.read_wholesale_prices'
  and permission_row.organization_id is null
  and permission_row.is_active is true
  and not exists (
    select 1
    from public.user_permissions existing
    where existing.user_id = permission_row.user_id
      and existing.organization_id = customer.organization_id
      and existing.permission = permission_row.permission
  )
order by
  permission_row.user_id,
  customer.organization_id,
  permission_row.permission,
  permission_row.created_at desc nulls last;

update public.user_permissions
set is_active = false
where permission = 'products.read_wholesale_prices'
  and organization_id is null
  and is_active is true;

alter table public.user_permissions
  drop constraint if exists user_permissions_wholesale_requires_org;

alter table public.user_permissions
  add constraint user_permissions_wholesale_requires_org
  check (
    permission <> 'products.read_wholesale_prices'
    or organization_id is not null
    or is_active is not true
  ) not valid;

alter table public.user_permissions
  validate constraint user_permissions_wholesale_requires_org;

-- Repair rows created before tenant isolation can point at a customer from a
-- different organization. Repair only unambiguous matches by linked profile.
with repair_customer_candidates as (
  select
    repair.id as repair_id,
    (array_agg(target_customer.id order by target_customer.created_at))[1] as target_customer_id
  from public.repairs repair
  join public.customers current_customer
    on current_customer.id = repair.customer_id
  join public.customers target_customer
    on target_customer.profile_id = current_customer.profile_id
   and target_customer.organization_id = repair.organization_id
  where repair.organization_id is not null
    and current_customer.organization_id is distinct from repair.organization_id
    and current_customer.profile_id is not null
  group by repair.id
  having count(*) = 1
)
update public.repairs repair
set customer_id = candidate.target_customer_id
from repair_customer_candidates candidate
where repair.id = candidate.repair_id;

create unique index if not exists idx_customers_id_organization_unique
  on public.customers(id, organization_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repairs_customer_organization_fkey'
      and conrelid = 'public.repairs'::regclass
  ) then
    alter table public.repairs
      add constraint repairs_customer_organization_fkey
      foreign key (customer_id, organization_id)
      references public.customers(id, organization_id)
      not valid;
  end if;
end
$$;

create index if not exists idx_repairs_org_customer_status
  on public.repairs(organization_id, customer_id, status, updated_at desc);

comment on constraint repairs_customer_organization_fkey on public.repairs is
  'Prevents new repair/customer links across organizations. Legacy invalid rows remain visible for explicit cleanup until the constraint can be validated.';
