
begin;

-- Drop permissive policies introduced in enable_select_for_pos_metrics
drop policy if exists "sales_select_authenticated_all" on public.sales;
drop policy if exists "customer_credits_select_authenticated_all" on public.customer_credits;
drop policy if exists "credit_installments_select_authenticated_all" on public.credit_installments;

commit;
