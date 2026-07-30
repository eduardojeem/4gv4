-- Transactional financial workflows for the dashboard.

begin;

alter table public.sales
  add column if not exists idempotency_key text;

create unique index if not exists idx_sales_org_idempotency_key
  on public.sales (organization_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.cash_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  session_id uuid not null references public.cash_closures(id) on delete cascade,
  counted_total numeric(14, 2) not null check (counted_total >= 0),
  expected_total numeric(14, 2) not null,
  discrepancy numeric(14, 2) not null,
  denominations jsonb not null default '{}'::jsonb,
  counted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_counts_org_branch_created
  on public.cash_counts (organization_id, branch_id, created_at desc);
create index if not exists idx_cash_counts_session
  on public.cash_counts (session_id, created_at desc);

alter table public.cash_counts enable row level security;

drop policy if exists "tenant members can read cash counts" on public.cash_counts;
create policy "tenant members can read cash counts"
on public.cash_counts for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  or public.has_org_permission(organization_id, 'pos.sales.read')
);

grant select on public.cash_counts to authenticated;

create or replace function public.open_cash_register_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_register_id text,
  p_opening_balance numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_session public.cash_closures%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if coalesce(trim(p_register_id), '') = '' then
    raise exception 'Register is required';
  end if;
  if coalesce(p_opening_balance, -1) < 0 then
    raise exception 'Opening balance cannot be negative';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.is_active = true
  ) then
    raise exception 'Branch does not belong to organization';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || coalesce(p_branch_id::text, 'none') || ':' || lower(trim(p_register_id)),
      0
    )
  );

  if exists (
    select 1
    from public.cash_closures c
    where c.organization_id = p_organization_id
      and c.branch_id is not distinct from p_branch_id
      and lower(c.register_id) = lower(trim(p_register_id))
      and c.date is null
  ) then
    raise exception 'Register is already open';
  end if;

  insert into public.cash_closures (
    type,
    register_id,
    date,
    opening_balance,
    opened_by,
    organization_id,
    branch_id,
    notes
  )
  values (
    'z',
    trim(p_register_id),
    null,
    p_opening_balance,
    actor_id::text,
    p_organization_id,
    p_branch_id,
    nullif(trim(p_note), '')
  )
  returning * into created_session;

  insert into public.cash_movements (
    session_id,
    type,
    amount,
    reason,
    created_by,
    created_at,
    organization_id,
    branch_id
  )
  values (
    created_session.id,
    'opening',
    p_opening_balance,
    case
      when nullif(trim(p_note), '') is null then 'Apertura de caja'
      else 'Apertura de caja - ' || trim(p_note)
    end,
    actor_id,
    now(),
    p_organization_id,
    p_branch_id
  );

  return jsonb_build_object(
    'id', created_session.id,
    'register_id', created_session.register_id,
    'opening_balance', created_session.opening_balance,
    'opened_by', created_session.opened_by,
    'opened_at', created_session.created_at,
    'organization_id', created_session.organization_id,
    'branch_id', created_session.branch_id
  );
end;
$$;

create or replace function public.close_cash_register_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_closing_balance numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_session public.cash_closures%rowtype;
  expected_total numeric;
  difference numeric;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if coalesce(p_closing_balance, -1) < 0 then
    raise exception 'Closing balance cannot be negative';
  end if;

  select *
  into target_session
  from public.cash_closures c
  where c.id = p_session_id
    and c.organization_id = p_organization_id
    and c.branch_id is not distinct from p_branch_id
  for update;

  if not found then
    raise exception 'Cash session not found in selected branch';
  end if;
  if target_session.date is not null then
    raise exception 'Cash session is already closed';
  end if;

  select coalesce(sum(
    case
      when m.type in ('opening', 'sale', 'cash_in') then m.amount
      when m.type = 'cash_out' then -m.amount
      else 0
    end
  ), 0)
  into expected_total
  from public.cash_movements m
  where m.session_id = target_session.id
    and m.organization_id = p_organization_id
    and m.branch_id is not distinct from p_branch_id;

  difference := p_closing_balance - expected_total;

  update public.cash_closures
  set closed_by = actor_id::text,
      closing_balance = p_closing_balance,
      expected_balance = expected_total,
      discrepancy = difference,
      date = now(),
      updated_at = now()
  where id = target_session.id;

  insert into public.cash_movements (
    session_id,
    type,
    amount,
    reason,
    created_by,
    created_at,
    organization_id,
    branch_id
  )
  values (
    target_session.id,
    'closing',
    p_closing_balance,
    'Cierre de caja',
    actor_id,
    now(),
    p_organization_id,
    p_branch_id
  );

  return jsonb_build_object(
    'id', target_session.id,
    'expected_balance', expected_total,
    'closing_balance', p_closing_balance,
    'discrepancy', difference,
    'closed_at', now()
  );
end;
$$;

create or replace function public.record_cash_count_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_counted_total numeric,
  p_denominations jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  expected_total numeric;
  created_count public.cash_counts%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if coalesce(p_counted_total, -1) < 0 then
    raise exception 'Counted total cannot be negative';
  end if;

  perform 1
  from public.cash_closures c
  where c.id = p_session_id
    and c.organization_id = p_organization_id
    and c.branch_id is not distinct from p_branch_id
    and c.date is null
  for update;

  if not found then
    raise exception 'Open cash session not found in selected branch';
  end if;

  select coalesce(sum(
    case
      when m.type in ('opening', 'sale', 'cash_in') then m.amount
      when m.type = 'cash_out' then -m.amount
      else 0
    end
  ), 0)
  into expected_total
  from public.cash_movements m
  where m.session_id = p_session_id
    and m.organization_id = p_organization_id
    and m.branch_id is not distinct from p_branch_id;

  insert into public.cash_counts (
    organization_id,
    branch_id,
    session_id,
    counted_total,
    expected_total,
    discrepancy,
    denominations,
    counted_by
  )
  values (
    p_organization_id,
    p_branch_id,
    p_session_id,
    p_counted_total,
    expected_total,
    p_counted_total - expected_total,
    coalesce(p_denominations, '{}'::jsonb),
    actor_id
  )
  returning * into created_count;

  return to_jsonb(created_count);
end;
$$;

create or replace function public.register_credit_payment_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_installment_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_installment public.credit_installments%rowtype;
  paid_total numeric;
  applied_amount numeric;
  target_session_id uuid;
  customer_name text;
  payment_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'crm.customers.manage') then
    raise exception 'Insufficient credit permissions';
  end if;
  if p_method not in ('cash', 'card', 'transfer') then
    raise exception 'Invalid payment method';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select i.*
  into target_installment
  from public.credit_installments i
  join public.customer_credits c on c.id = i.credit_id
  where i.id = p_installment_id
    and c.organization_id = p_organization_id
  for update of i;

  if not found then
    raise exception 'Installment does not belong to organization';
  end if;

  select coalesce(sum(p.amount), 0)
  into paid_total
  from public.credit_payments p
  where p.installment_id = target_installment.id;

  applied_amount := least(p_amount, greatest(target_installment.amount - paid_total, 0));
  if applied_amount <= 0 then
    raise exception 'Installment has no outstanding balance';
  end if;

  if p_method = 'cash' then
    if p_branch_id is null then
      raise exception 'A branch is required for cash payments';
    end if;

    select c.id
    into target_session_id
    from public.cash_closures c
    where c.organization_id = p_organization_id
      and c.branch_id = p_branch_id
      and c.date is null
    order by
      case when lower(c.register_id) = 'principal' then 0 else 1 end,
      c.created_at desc
    limit 1
    for update;

    if target_session_id is null then
      raise exception 'Open cash session required for cash payment';
    end if;
  end if;

  insert into public.credit_payments (
    credit_id,
    installment_id,
    amount,
    payment_method,
    notes
  )
  values (
    target_installment.credit_id,
    target_installment.id,
    applied_amount,
    p_method,
    nullif(trim(p_notes), '')
  )
  returning id into payment_id;

  if p_method = 'cash' then
    select c.name
    into customer_name
    from public.customer_credits cc
    join public.customers c on c.id = cc.customer_id
    where cc.id = target_installment.credit_id;

    insert into public.cash_movements (
      session_id,
      type,
      amount,
      reason,
      payment_method,
      created_by,
      created_at,
      organization_id,
      branch_id
    )
    values (
      target_session_id,
      'cash_in',
      applied_amount,
      'Cobro cuota credito' ||
        case when customer_name is null then '' else ' - ' || customer_name end ||
        case when nullif(trim(p_notes), '') is null then '' else ' (' || trim(p_notes) || ')' end,
      'cash',
      actor_id,
      now(),
      p_organization_id,
      p_branch_id
    );
  end if;

  return jsonb_build_object(
    'payment_id', payment_id,
    'installment_id', target_installment.id,
    'credit_id', target_installment.credit_id,
    'installment_number', target_installment.installment_number,
    'applied_amount', applied_amount,
    'requested_amount', p_amount
  );
end;
$$;

create or replace function public.decrement_pos_stock_batch_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  product_stock numeric;
  branch_stock numeric;
begin
  if p_branch_id is null or not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.is_active = true
  ) then
    raise exception 'Invalid branch for stock operation';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one stock item is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_branch_id::text || ':pos-stock', 0)
  );

  for item in
    select
      (value->>'product_id')::uuid as product_id,
      sum((value->>'quantity')::numeric) as quantity
    from jsonb_array_elements(p_items)
    group by (value->>'product_id')::uuid
    order by (value->>'product_id')::uuid
  loop
    if item.quantity <= 0 then
      raise exception 'Stock quantity must be positive';
    end if;

    select p.stock_quantity
    into product_stock
    from public.products p
    where p.id = item.product_id
      and p.organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'Product % does not belong to organization', item.product_id;
    end if;

    insert into public.branch_inventory (branch_id, product_id, stock_quantity)
    values (p_branch_id, item.product_id, product_stock)
    on conflict (branch_id, product_id) do nothing;

    select bi.stock_quantity
    into branch_stock
    from public.branch_inventory bi
    where bi.branch_id = p_branch_id
      and bi.product_id = item.product_id
    for update;

    if product_stock < item.quantity or branch_stock < item.quantity then
      raise exception 'Insufficient stock for product %', item.product_id;
    end if;

    update public.products
    set stock_quantity = stock_quantity - item.quantity,
        updated_at = now()
    where id = item.product_id
      and organization_id = p_organization_id;

    update public.branch_inventory
    set stock_quantity = stock_quantity - item.quantity,
        updated_at = now()
    where branch_id = p_branch_id
      and product_id = item.product_id;
  end loop;

  return true;
end;
$$;

create or replace function public.create_dashboard_order_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_customer_id uuid,
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_customer_id uuid := p_customer_id;
  created_order_id uuid;
  item record;
begin
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.is_active = true
  ) then
    raise exception 'Invalid branch for order';
  end if;

  if resolved_customer_id is not null and not exists (
    select 1 from public.customers c
    where c.id = resolved_customer_id
      and c.organization_id = p_organization_id
  ) then
    raise exception 'Customer does not belong to organization';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_branch_id::text || ':order-stock', 0)
  );

  for item in
    select
      (value->>'product_id')::uuid as product_id,
      sum((value->>'quantity')::integer) as quantity
    from jsonb_array_elements(p_items)
    group by (value->>'product_id')::uuid
    order by (value->>'product_id')::uuid
  loop
    update public.branch_inventory bi
    set stock_quantity = bi.stock_quantity - item.quantity,
        updated_at = now()
    from public.products p
    where bi.branch_id = p_branch_id
      and bi.product_id = item.product_id
      and bi.stock_quantity >= item.quantity
      and p.id = bi.product_id
      and p.organization_id = p_organization_id;

    if not found then
      raise exception 'Insufficient stock for product %', item.product_id;
    end if;
  end loop;

  if resolved_customer_id is null then
    insert into public.customers (
      organization_id,
      name,
      email,
      phone,
      address,
      status,
      customer_type,
      created_at,
      updated_at
    )
    values (
      p_organization_id,
      p_customer->>'name',
      nullif(p_customer->>'email', ''),
      coalesce(p_customer->>'phone', ''),
      nullif(p_customer->>'address', ''),
      'active',
      'regular',
      now(),
      now()
    )
    returning id into resolved_customer_id;
  end if;

  insert into public.customer_orders (
    organization_id,
    branch_id,
    customer_id,
    order_number,
    status,
    payment_status,
    payment_method,
    fulfillment_type,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    subtotal,
    tax_amount,
    shipping_cost,
    discount_amount,
    total,
    notes,
    stock_reserved,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_organization_id,
    p_branch_id,
    resolved_customer_id,
    p_order->>'order_number',
    'PENDING',
    'PENDING',
    p_order->>'payment_method',
    p_order->>'fulfillment_type',
    p_customer->>'name',
    nullif(p_customer->>'email', ''),
    nullif(p_customer->>'phone', ''),
    nullif(p_customer->>'address', ''),
    (p_order->>'subtotal')::numeric,
    0,
    (p_order->>'shipping_cost')::numeric,
    (p_order->>'discount_amount')::numeric,
    (p_order->>'total')::numeric,
    nullif(p_order->>'notes', ''),
    true,
    p_actor_id,
    now(),
    now()
  )
  returning id into created_order_id;

  insert into public.customer_order_items (
    organization_id,
    order_id,
    product_id,
    product_name,
    product_sku,
    quantity,
    unit_price,
    subtotal
  )
  select
    p_organization_id,
    created_order_id,
    (value->>'product_id')::uuid,
    value->>'product_name',
    nullif(value->>'product_sku', ''),
    (value->>'quantity')::integer,
    (value->>'unit_price')::numeric,
    (value->>'subtotal')::numeric
  from jsonb_array_elements(p_items);

  insert into public.customer_order_status_history (
    organization_id,
    order_id,
    to_status,
    note,
    changed_by
  )
  values (
    p_organization_id,
    created_order_id,
    'PENDING',
    'Pedido creado desde el dashboard.',
    p_actor_id
  );

  return jsonb_build_object(
    'order_id', created_order_id,
    'customer_id', resolved_customer_id
  );
end;
$$;

revoke all on function public.open_cash_register_atomic(uuid, uuid, text, numeric, text) from public;
revoke all on function public.close_cash_register_atomic(uuid, uuid, uuid, numeric) from public;
revoke all on function public.record_cash_count_atomic(uuid, uuid, uuid, numeric, jsonb) from public;
revoke all on function public.register_credit_payment_atomic(uuid, uuid, uuid, numeric, text, text) from public;
revoke all on function public.decrement_pos_stock_batch_atomic(uuid, uuid, jsonb) from public;
revoke all on function public.create_dashboard_order_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb) from public;

grant execute on function public.open_cash_register_atomic(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.close_cash_register_atomic(uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.record_cash_count_atomic(uuid, uuid, uuid, numeric, jsonb) to authenticated;
grant execute on function public.register_credit_payment_atomic(uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.decrement_pos_stock_batch_atomic(uuid, uuid, jsonb) to service_role;
grant execute on function public.create_dashboard_order_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb) to service_role;

commit;
