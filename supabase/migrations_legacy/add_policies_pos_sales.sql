begin;

alter table public.sales enable row level security;

create policy "sales_insert_own"
on public.sales
for insert
to authenticated
with check (created_by = auth.uid());

create policy "sales_select_own"
on public.sales
for select
to authenticated
using (created_by = auth.uid());

alter table public.sale_items enable row level security;

create policy "sale_items_insert_with_own_sale"
on public.sale_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.created_by = auth.uid()
  )
);

create policy "sale_items_select_with_own_sale"
on public.sale_items
for select
to authenticated
using (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.created_by = auth.uid()
  )
);

commit;
