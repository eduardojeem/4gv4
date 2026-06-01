-- Audit payment status changes for ecommerce customer orders.

create table if not exists public.customer_order_payment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  from_status text,
  to_status text not null
    check (to_status in ('PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED')),
  payment_method text,
  amount numeric(12,2),
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_order_payment_history_order
on public.customer_order_payment_history(organization_id, order_id, created_at desc);

alter table public.customer_order_payment_history enable row level security;

drop policy if exists "tenant members can read customer order payment history"
on public.customer_order_payment_history;
create policy "tenant members can read customer order payment history"
on public.customer_order_payment_history
for select
using (
  public.has_org_permission(organization_id, 'ecommerce.orders.manage')
);

drop policy if exists "tenant members can create customer order payment history"
on public.customer_order_payment_history;
create policy "tenant members can create customer order payment history"
on public.customer_order_payment_history
for insert
with check (
  public.has_org_permission(organization_id, 'ecommerce.orders.manage')
);
