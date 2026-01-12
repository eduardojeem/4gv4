begin;

-- Allow authenticated users to read sales for metrics
alter table public.sales enable row level security;
create policy "sales_select_authenticated_all"
on public.sales
for select
to authenticated
using (true);

-- Allow authenticated users to read customer credits for metrics
alter table public.customer_credits enable row level security;
create policy "customer_credits_select_authenticated_all"
on public.customer_credits
for select
to authenticated
using (true);

-- Allow authenticated users to read credit installments for metrics
alter table public.credit_installments enable row level security;
create policy "credit_installments_select_authenticated_all"
on public.credit_installments
for select
to authenticated
using (true);

commit;
