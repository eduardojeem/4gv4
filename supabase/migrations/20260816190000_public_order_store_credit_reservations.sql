begin;

alter table public.customer_orders
  add column if not exists store_credit_reserved numeric(14, 2) not null default 0
    check (store_credit_reserved >= 0),
  add column if not exists store_credit_applied numeric(14, 2) not null default 0
    check (store_credit_applied >= 0);

alter table public.customer_store_credits
  drop constraint if exists customer_store_credits_source_type_check;
alter table public.customer_store_credits
  add constraint customer_store_credits_source_type_check
  check (source_type in ('after_sales', 'sale', 'repair', 'order', 'manual'));

create unique index if not exists customer_store_credits_one_per_order
  on public.customer_store_credits (organization_id, source_id)
  where source_type = 'order' and source_id is not null;

create table if not exists public.customer_store_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'released')),
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, order_id)
);

create index if not exists idx_store_credit_reservations_customer_active
  on public.customer_store_credit_reservations (organization_id, customer_id, status)
  where status = 'reserved';

alter table public.customer_store_credit_reservations enable row level security;

drop policy if exists "store credit reservation owner read" on public.customer_store_credit_reservations;
create policy "store credit reservation owner read"
  on public.customer_store_credit_reservations
  for select
  to authenticated
  using (
    public.has_org_permission(organization_id, 'ecommerce.orders.manage')
    or exists (
      select 1
      from public.customers customer
      where customer.id = customer_store_credit_reservations.customer_id
        and customer.organization_id = customer_store_credit_reservations.organization_id
        and customer.profile_id = (select auth.uid())
    )
  );

create or replace function public.create_public_order_with_store_credit_atomic(
  p_organization_id uuid,
  p_customer_id uuid,
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb,
  p_promotion_id uuid,
  p_profile_id uuid,
  p_profile_name text,
  p_profile_email text,
  p_profile_phone text,
  p_store_credit_amount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order jsonb;
  created_order_id uuid;
  created_customer_id uuid;
  requested_amount numeric := round(greatest(0, coalesce(p_store_credit_amount, 0)), 2);
  order_total numeric := 0;
  ledger_balance numeric := 0;
  reserved_balance numeric := 0;
  available_balance numeric := 0;
begin
  if requested_amount > 0 and p_profile_id is null then
    raise exception 'STORE_CREDIT_PROFILE_REQUIRED';
  end if;

  created_order := public.create_public_order_with_customer_account_atomic(
    p_organization_id,
    p_customer_id,
    p_customer,
    p_order,
    p_items,
    p_promotion_id,
    p_profile_id,
    p_profile_name,
    p_profile_email,
    p_profile_phone
  );

  created_order_id := nullif(created_order->>'order_id', '')::uuid;
  created_customer_id := nullif(created_order->>'customer_id', '')::uuid;

  if requested_amount <= 0 then
    return created_order || jsonb_build_object(
      'store_credit_reserved', 0,
      'store_credit_applied', 0
    );
  end if;

  perform 1
  from public.customers customer
  where customer.id = created_customer_id
    and customer.organization_id = p_organization_id
    and customer.profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'STORE_CREDIT_PROFILE_REQUIRED';
  end if;

  select customer_order.total
  into order_total
  from public.customer_orders customer_order
  where customer_order.id = created_order_id
    and customer_order.organization_id = p_organization_id
  for update;

  if requested_amount > order_total then
    raise exception 'STORE_CREDIT_EXCEEDS_ORDER_TOTAL';
  end if;

  select coalesce(sum(movement.amount), 0)
  into ledger_balance
  from public.customer_store_credits movement
  where movement.organization_id = p_organization_id
    and movement.customer_id = created_customer_id;

  select coalesce(sum(reservation.amount), 0)
  into reserved_balance
  from public.customer_store_credit_reservations reservation
  where reservation.organization_id = p_organization_id
    and reservation.customer_id = created_customer_id
    and reservation.status = 'reserved';

  available_balance := ledger_balance - reserved_balance;
  if requested_amount > available_balance then
    raise exception 'STORE_CREDIT_EXCEEDS_AVAILABLE|%', greatest(0, available_balance);
  end if;

  insert into public.customer_store_credit_reservations (
    organization_id, customer_id, order_id, amount, status, created_by
  ) values (
    p_organization_id, created_customer_id, created_order_id,
    requested_amount, 'reserved', p_profile_id
  );

  update public.customer_orders
  set store_credit_reserved = requested_amount,
      store_credit_applied = 0,
      payment_status = 'PARTIAL',
      updated_at = now()
  where id = created_order_id
    and organization_id = p_organization_id;

  return created_order || jsonb_build_object(
    'store_credit_reserved', requested_amount,
    'store_credit_applied', 0,
    'amount_due', greatest(0, order_total - requested_amount)
  );
end;
$$;

create or replace function public.confirm_customer_order_store_credit_atomic(
  p_organization_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.customer_orders%rowtype;
  reservation_row public.customer_store_credit_reservations%rowtype;
  applied_amount numeric := 0;
begin
  if p_actor_id is null or not exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'seller', 'cashier')
  ) then
    raise exception 'ORDER_PERMISSION_DENIED';
  end if;

  select * into order_row
  from public.customer_orders customer_order
  where customer_order.id = p_order_id
    and customer_order.organization_id = p_organization_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status = 'CANCELLED' then raise exception 'ORDER_ALREADY_CANCELLED'; end if;

  select * into reservation_row
  from public.customer_store_credit_reservations reservation
  where reservation.organization_id = p_organization_id
    and reservation.order_id = p_order_id
  for update;

  if found then
    applied_amount := reservation_row.amount;
    if reservation_row.status = 'reserved' then
      insert into public.customer_store_credits (
        organization_id, customer_id, amount, reason, source_type, source_id, created_by
      ) values (
        p_organization_id, reservation_row.customer_id, -reservation_row.amount,
        'Aplicado al pedido ' || order_row.order_number,
        'order', p_order_id, p_actor_id
      )
      on conflict (organization_id, source_id)
        where source_type = 'order' and source_id is not null
      do nothing;

      update public.customer_store_credit_reservations
      set status = 'consumed', consumed_at = now(), updated_at = now()
      where id = reservation_row.id and status = 'reserved';
    elsif reservation_row.status = 'released' then
      raise exception 'STORE_CREDIT_RESERVATION_RELEASED';
    end if;
  end if;

  update public.customer_orders
  set status = 'CONFIRMED',
      store_credit_reserved = 0,
      store_credit_applied = applied_amount,
      payment_status = case when applied_amount >= total then 'PAID'
                            when applied_amount > 0 then 'PARTIAL'
                            else payment_status end,
      updated_at = now()
  where id = p_order_id and organization_id = p_organization_id;

  if order_row.status is distinct from 'CONFIRMED' then
    insert into public.customer_order_status_history (
      organization_id, order_id, from_status, to_status, note, changed_by
    ) values (
      p_organization_id, p_order_id, order_row.status, 'CONFIRMED', p_note, p_actor_id
    );
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'store_credit_applied', applied_amount,
    'amount_due', greatest(0, order_row.total - applied_amount),
    'payment_status', case when applied_amount >= order_row.total then 'PAID'
                           when applied_amount > 0 then 'PARTIAL'
                           else order_row.payment_status end
  );
end;
$$;

create or replace function public.cancel_customer_order_atomic(
  p_organization_id uuid,
  p_order_id uuid,
  p_actor_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.customer_orders%rowtype;
  released_amount numeric := 0;
begin
  select * into order_row
  from public.customer_orders customer_order
  where customer_order.id = p_order_id
    and customer_order.organization_id = p_organization_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status = 'CANCELLED' then
    return jsonb_build_object('order_id', order_row.id, 'from_status', order_row.status,
      'stock_released', false, 'store_credit_released', 0);
  end if;

  update public.customer_store_credit_reservations
  set status = 'released', released_at = now(), updated_at = now()
  where organization_id = p_organization_id
    and order_id = p_order_id
    and status = 'reserved'
  returning amount into released_amount;

  if order_row.stock_reserved then
    if order_row.branch_id is null then
      update public.products product
      set stock_quantity = product.stock_quantity + quantities.quantity, updated_at = now()
      from (
        select item.product_id, sum(item.quantity)::integer as quantity
        from public.customer_order_items item
        where item.order_id = order_row.id and item.product_id is not null
        group by item.product_id
      ) quantities
      where product.id = quantities.product_id
        and product.organization_id = p_organization_id;
    else
      update public.branch_inventory inventory
      set stock_quantity = inventory.stock_quantity + quantities.quantity, updated_at = now()
      from (
        select item.product_id, sum(item.quantity)::integer as quantity
        from public.customer_order_items item
        where item.order_id = order_row.id and item.product_id is not null
        group by item.product_id
      ) quantities
      where inventory.branch_id = order_row.branch_id
        and inventory.product_id = quantities.product_id;
    end if;
  end if;

  update public.customer_orders
  set status = 'CANCELLED', stock_reserved = false, store_credit_reserved = 0,
      cancelled_at = now(), updated_at = now()
  where id = order_row.id and organization_id = p_organization_id;

  insert into public.customer_order_status_history (
    organization_id, order_id, from_status, to_status, note, changed_by
  ) values (p_organization_id, order_row.id, order_row.status, 'CANCELLED', p_note, p_actor_id);

  return jsonb_build_object(
    'order_id', order_row.id,
    'from_status', order_row.status,
    'stock_released', order_row.stock_reserved,
    'store_credit_released', coalesce(released_amount, 0)
  );
end;
$$;

create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_order record;
  expired_count integer := 0;
begin
  for stale_order in
    select id, organization_id
    from public.customer_orders
    where status = 'PENDING'
      and payment_status in ('PENDING', 'PARTIAL')
      and stock_reserved = true
      and created_at < now() - interval '72 hours'
    order by created_at
    for update skip locked
  loop
    perform public.cancel_customer_order_atomic(
      stale_order.organization_id, stale_order.id, null,
      'Expirada automaticamente por falta de pago (72h).'
    );
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on table public.customer_store_credit_reservations from anon;
grant select on table public.customer_store_credit_reservations to authenticated;

revoke all on function public.create_public_order_with_store_credit_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
revoke all on function public.confirm_customer_order_store_credit_atomic(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.cancel_customer_order_atomic(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.expire_stale_orders()
  from public, anon, authenticated;

grant execute on function public.create_public_order_with_store_credit_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text, numeric)
  to service_role;
grant execute on function public.confirm_customer_order_store_credit_atomic(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.cancel_customer_order_atomic(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.expire_stale_orders()
  to service_role;

commit;
