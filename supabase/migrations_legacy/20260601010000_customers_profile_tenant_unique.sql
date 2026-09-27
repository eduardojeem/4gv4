-- SaaS customer portal: one auth profile can be a customer in multiple organizations.
-- Legacy single-tenant installs had a global unique index on customers(profile_id),
-- which prevents linking the same user as customer in another organization.

drop index if exists public.idx_customers_profile_id;
drop index if exists public.idx_customers_org_profile_id;

create unique index if not exists idx_customers_org_profile_id
on public.customers(organization_id, profile_id)
where profile_id is not null;

create index if not exists idx_customers_profile_id_lookup
on public.customers(profile_id)
where profile_id is not null;
