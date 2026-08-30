begin;

-- Private operational data must always be protected by RLS, even when this
-- migration is applied to an environment that skipped an older hardening file.
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.repairs enable row level security;
alter table public.cash_registers enable row level security;
alter table public.cash_closures enable row level security;
alter table public.cash_movements enable row level security;
alter table public.customer_credits enable row level security;
alter table public.credit_installments enable row level security;
alter table public.credit_payments enable row level security;

-- Known product policies from legacy and emergency migrations. Some were
-- intentionally public at the time, but also applied to authenticated users
-- and therefore bypassed tenant membership checks.
drop policy if exists "Auth read active products" on public.products;
drop policy if exists "allow authenticated read products" on public.products;
drop policy if exists products_read_all on public.products;
drop policy if exists pos_products_read_all on public.products;
drop policy if exists "Authenticated users can read products" on public.products;
drop policy if exists "Enable read access for authenticated users" on public.products;
drop policy if exists "Public read active products" on public.products;
drop policy if exists "public can read active products" on public.products;
drop policy if exists "public can read visible active products" on public.products;
drop policy if exists "public can read public active products" on public.products;

-- Remove only policies whose predicate is an unconditional authenticated read.
-- Secure tenant policies and customer self-service policies are preserved.
do $cleanup$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'products', 'categories', 'customers', 'sales', 'repairs',
        'cash_registers', 'cash_closures', 'cash_movements',
        'customer_credits', 'credit_installments', 'credit_payments'
      )
      and cmd in ('SELECT', 'ALL')
      and (
        regexp_replace(coalesce(qual, ''), '\\s', '', 'g') in (
          'true',
          '(true)',
          '(auth.role()=''authenticated''::text)',
          '((auth.role())::text=''authenticated''::text)'
        )
        or (
          roles && array['authenticated'::name, 'public'::name]
          and regexp_replace(coalesce(qual, ''), '\\s', '', 'g') ~ '^\\(*true\\)*$'
        )
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$cleanup$;

-- Reassert the canonical tenant-scoped reads. Dropping first makes the
-- migration idempotent and avoids combining multiple permissive policies.
drop policy if exists "tenant members can read products" on public.products;
create policy "tenant members can read products"
on public.products for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.read'));

drop policy if exists "tenant members can read categories" on public.categories;
create policy "tenant members can read categories"
on public.categories for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.read'));

drop policy if exists "tenant members can read customers" on public.customers;
create policy "tenant members can read customers"
on public.customers for select to authenticated
using (
  public.has_org_permission(organization_id, 'crm.customers.read')
  or public.has_org_permission(organization_id, 'crm.customers.manage')
  or public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.create')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
);

drop policy if exists "tenant members can read sales" on public.sales;
create policy "tenant members can read sales"
on public.sales for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
  or public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists "tenant members can read repairs" on public.repairs;
create policy "tenant members can read repairs"
on public.repairs for select to authenticated
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.assign')
);

drop policy if exists "Usuarios autenticados pueden ver cajas" on public.cash_registers;
drop policy if exists "tenant members can read cash registers" on public.cash_registers;
create policy "tenant members can read cash registers"
on public.cash_registers for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  or public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
);

drop policy if exists "tenant members can read cash closures" on public.cash_closures;
create policy "tenant members can read cash closures"
on public.cash_closures for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  or public.has_org_permission(organization_id, 'pos.sales.read')
);

drop policy if exists "tenant members can read cash movements" on public.cash_movements;
drop policy if exists cash_movements_select_org on public.cash_movements;
create policy "tenant members can read cash movements"
on public.cash_movements for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  or public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
);

drop policy if exists "Read credits" on public.customer_credits;
drop policy if exists customer_credits_select_authenticated on public.customer_credits;
drop policy if exists customer_credits_select_authenticated_all on public.customer_credits;
drop policy if exists "tenant members can read customer credits" on public.customer_credits;
create policy "tenant members can read customer credits"
on public.customer_credits for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'customers.credits.read')
  or public.has_org_permission(organization_id, 'repairs.orders.read')
);

drop policy if exists "Read installments" on public.credit_installments;
drop policy if exists credit_installments_select_authenticated on public.credit_installments;
drop policy if exists credit_installments_select_authenticated_all on public.credit_installments;
drop policy if exists "tenant members can read credit installments" on public.credit_installments;
create policy "tenant members can read credit installments"
on public.credit_installments for select to authenticated
using (
  exists (
    select 1
    from public.customer_credits cc
    where cc.id = credit_installments.credit_id
      and (
        public.has_org_permission(cc.organization_id, 'pos.sales.read')
        or public.has_org_permission(cc.organization_id, 'customers.credits.read')
        or public.has_org_permission(cc.organization_id, 'repairs.orders.read')
      )
  )
);

drop policy if exists "Read payments" on public.credit_payments;
drop policy if exists credit_payments_select_authenticated on public.credit_payments;
drop policy if exists "tenant members can read credit payments" on public.credit_payments;
create policy "tenant members can read credit payments"
on public.credit_payments for select to authenticated
using (
  exists (
    select 1
    from public.customer_credits cc
    where cc.id = credit_payments.credit_id
      and (
        public.has_org_permission(cc.organization_id, 'pos.sales.read')
        or public.has_org_permission(cc.organization_id, 'customers.credits.read')
        or public.has_org_permission(cc.organization_id, 'repairs.orders.read')
      )
  )
);

-- Public catalog access is explicit and does not apply to authenticated users.
-- The application marketplace additionally scopes by organization on the server.
drop policy if exists "anonymous can read visible active products" on public.products;
drop policy if exists "anonymous can read public active products" on public.products;
do $public_catalog$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'visible_in_store'
  ) then
    execute $policy$
      create policy "anonymous can read visible active products"
      on public.products for select to anon
      using (is_active = true and visible_in_store = true)
    $policy$;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'is_public'
  ) then
    execute $policy$
      create policy "anonymous can read public active products"
      on public.products for select to anon
      using (is_active = true and is_public = true)
    $policy$;
  end if;
end
$public_catalog$;

drop view if exists public.credit_installments_progress;
create view public.credit_installments_progress
with (security_invoker = true)
as
select
  i.id,
  i.credit_id,
  cc.organization_id,
  i.installment_number,
  i.due_date,
  i.amount,
  coalesce(i.amount_paid, 0) as amount_paid,
  case
    when coalesce(i.amount_paid, 0) >= i.amount then 'paid'
    when i.due_date < now() then 'late'
    else 'pending'
  end as status_effective,
  case
    when i.amount > 0
      then least(100, round((coalesce(i.amount_paid, 0) / i.amount) * 100)::int)
    else 0
  end as progreso
from public.credit_installments i
join public.customer_credits cc on cc.id = i.credit_id;

revoke all on public.credit_installments_progress from public;
revoke all on public.credit_installments_progress from anon;
grant select on public.credit_installments_progress to authenticated;

commit;
