-- RESTRICTIVE RECOVERY, not a restoration of the insecure pre-S1 baseline.
-- Local draft only. Keeps 01/04, 03 ACL, safe views and their dependencies.
-- Disables cost reads and derived cost metrics for EVERY authenticated user.
-- Restores availability of non-cost product data without reopening cost access.
-- No function is dropped; existing EXECUTE ACLs are preserved. No data changes.
-- Reapply reviewed 02 to leave this degraded mode. Never run rollback_04.
begin;
create or replace function public.get_product_costs(p_product_ids uuid[] default null, p_organization_id uuid default null)
returns table(product_id uuid, organization_id uuid, purchase_price numeric, foreign_purchase_price numeric)
language sql stable security definer set search_path = '' as $$
  select null::uuid, null::uuid, null::numeric, null::numeric where false;
$$;
create or replace function public.get_variant_costs(p_variant_ids uuid[] default null, p_organization_id uuid default null)
returns table(variant_id uuid, product_id uuid, organization_id uuid, purchase_price numeric)
language sql stable security definer set search_path = '' as $$
  select null::uuid, null::uuid, null::uuid, null::numeric where false;
$$;
create or replace function public.can_read_product_cost(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$ select false; $$;
revoke all on function public.get_product_costs(uuid[],uuid), public.get_variant_costs(uuid[],uuid), public.can_read_product_cost(uuid) from public, anon;
grant execute on function public.get_product_costs(uuid[],uuid), public.get_variant_costs(uuid[],uuid), public.can_read_product_cost(uuid) to authenticated, service_role;
commit;
