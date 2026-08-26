
begin;

-- 1. Drop the permissive policies
drop policy if exists "sales_select_authenticated_all" on public.sales;
drop policy if exists "customer_credits_select_authenticated_all" on public.customer_credits;
drop policy if exists "credit_installments_select_authenticated_all" on public.credit_installments;

-- 2. Restore/Create secure policies

-- Sales already has a secure policy: "tenant members can read sales" created in 20260601007000_sales_pos_tenant_rls.sql. We do not need to recreate it.

-- Customer Credits
drop policy if exists "tenant members can read customer credits" on public.customer_credits;
create policy "tenant members can read customer credits"
on public.customer_credits
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'customers.credits.read')
  or public.has_org_permission(organization_id, 'repairs.orders.read')
);

-- Credit Installments
drop policy if exists "tenant members can read credit installments" on public.credit_installments;
create policy "tenant members can read credit installments"
on public.credit_installments
for select
to authenticated
using (
  exists (
    select 1 from public.customer_credits c
    where c.id = credit_installments.credit_id
    and (
      public.has_org_permission(c.organization_id, 'pos.sales.read')
      or public.has_org_permission(c.organization_id, 'customers.credits.read')
      or public.has_org_permission(c.organization_id, 'repairs.orders.read')
    )
  )
);

commit;
