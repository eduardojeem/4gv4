-- org_catalog_counts: per-organization catalog size, aggregated in the database.
--
-- Powers the superadmin /web-content/marketplace dashboard so it no longer has to
-- pull EVERY product row across all tenants into the app just to count them.
-- Postgres aggregates and returns one row per org.
--
-- security_invoker = true → the view respects the querying role's RLS on the
-- underlying tables; access is also explicitly revoked from anon/authenticated.
-- Only the service-role (admin client used by the superadmin page) reads it.

create or replace view public.org_catalog_counts
with (security_invoker = true) as
select
  o.id as organization_id,
  coalesce(p.products, 0)::bigint as products,
  coalesce(c.categories, 0)::bigint as categories
from public.organizations o
left join (
  select organization_id, count(*) as products
  from public.products
  group by organization_id
) p on p.organization_id = o.id
left join (
  select organization_id, count(*) as categories
  from public.categories
  group by organization_id
) c on c.organization_id = o.id;

comment on view public.org_catalog_counts is
  'Per-organization product/category counts for superadmin dashboards (service-role only).';

revoke all on public.org_catalog_counts from anon, authenticated;
grant select on public.org_catalog_counts to service_role;
