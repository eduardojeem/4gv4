-- Commit a POS sale, payments, stock, credit, repairs and cash movements together.

begin;

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_index integer not null check (payment_index >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'credit')),
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, sale_id, payment_index)
);

create index if not exists idx_sale_payments_org_created
  on public.sale_payments (organization_id, created_at desc);
create index if not exists idx_sale_payments_sale
  on public.sale_payments (sale_id, payment_index);

alter table public.sale_payments enable row level security;

drop policy if exists "tenant members can read sale payments" on public.sale_payments;
create policy "tenant members can read sale payments"
on public.sale_payments for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.sales.read')
  or public.has_org_permission(organization_id, 'pos.sales.create')
);

grant select on public.sale_payments to authenticated;
grant all on public.sale_payments to service_role;

alter table public.cash_movements
  add column if not exists sale_id uuid references public.sales(id) on delete restrict,
  add column if not exists payment_index integer;

create unique index if not exists idx_cash_movements_org_sale_payment
  on public.cash_movements (organization_id, sale_id, payment_index)
  where type = 'sale' and sale_id is not null and payment_index is not null;

create unique index if not exists idx_customer_credits_org_sale_unique
  on public.customer_credits (organization_id, sale_id)
  where sale_id is not null;

create or replace function public.process_pos_sale_atomic_v2(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_session_id uuid,
  p_idempotency_key text,
  p_code text,
  p_customer_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_price_mode text default 'retail',
  p_order_discount_rate numeric default 0,
  p_notes text default null,
  p_tax_rate numeric default 0,
  p_prices_include_tax boolean default true,
  p_credit jsonb default null,
  p_repair_ids jsonb default '[]'::jsonb,
  p_mark_repairs_delivered boolean default false,
  p_delivery_outcome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_sale_id uuid;
  created_sale_id uuid := gen_random_uuid();
  item record;
  payment record;
  selected_product public.products%rowtype;
  branch_stock numeric;
  unit_price numeric;
  line_base numeric;
  line_discount numeric;
  products_subtotal numeric := 0;
  total_discount numeric := 0;
  order_discount numeric := 0;
  repairs_subtotal numeric := 0;
  products_net numeric := 0;
  net_subtotal numeric := 0;
  tax_amount numeric := 0;
  sale_total numeric := 0;
  payments_total numeric := 0;
  payment_count integer := 0;
  payment_method_summary text;
  credit_base numeric := 0;
  credit_limit numeric := 0;
  current_credit_balance numeric := 0;
  available_credit numeric := 0;
  credit_rate numeric := 0;
  credit_count integer := 1;
  credit_frequency text := 'monthly';
  financed_total numeric := 0;
  created_credit_id uuid;
  installment_base numeric;
  principal_base numeric;
  installment_index integer;
  installment_due timestamptz;
begin
  if p_actor_id is null or not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'cashier', 'technician', 'seller')
  ) then
    raise exception 'POS_PERMISSION_DENIED';
  end if;

  if p_branch_id is null or not exists (
    select 1 from public.branches branch
    where branch.id = p_branch_id
      and branch.organization_id = p_organization_id
      and branch.is_active = true
  ) then
    raise exception 'INVALID_POS_BRANCH';
  end if;

  if p_session_id is null or not exists (
    select 1 from public.cash_closures closure
    where closure.id = p_session_id
      and closure.organization_id = p_organization_id
      and closure.branch_id = p_branch_id
      and closure.date is null
  ) then
    raise exception 'CASH_REGISTER_NOT_OPEN';
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':pos:' || trim(p_idempotency_key), 0)
  );

  select sale.id into existing_sale_id
  from public.sales sale
  where sale.organization_id = p_organization_id
    and sale.idempotency_key = trim(p_idempotency_key);

  if existing_sale_id is not null then
    return jsonb_build_object('sale_id', existing_sale_id, 'idempotent', true);
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = p_organization_id
  ) then
    raise exception 'CUSTOMER_NOT_IN_ORGANIZATION';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_POS_ITEMS';
  end if;
  if jsonb_typeof(coalesce(p_payments, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) = 0 then
    raise exception 'PAYMENTS_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_repair_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_REPAIR_LIST';
  end if;

  for item in
    select
      (value->>'product_id')::uuid as product_id,
      sum((value->>'quantity')::integer)::integer as quantity,
      sum(greatest(0, coalesce((value->>'discount_amount')::numeric, 0))) as discount_amount
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    group by (value->>'product_id')::uuid
    order by (value->>'product_id')::uuid
  loop
    if item.product_id is null or item.quantity <= 0 then
      raise exception 'INVALID_ORDER_QUANTITY';
    end if;

    select product.* into selected_product
    from public.products product
    where product.id = item.product_id
      and product.organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_IN_ORGANIZATION';
    end if;

    select inventory.stock_quantity into branch_stock
    from public.branch_inventory inventory
    where inventory.branch_id = p_branch_id
      and inventory.product_id = item.product_id
    for update;

    if not found then
      raise exception 'BRANCH_INVENTORY_NOT_CONFIGURED|%', item.product_id;
    end if;
    if coalesce(selected_product.stock_quantity, 0) < item.quantity or coalesce(branch_stock, 0) < item.quantity then
      raise exception 'INSUFFICIENT_STOCK|%|%', item.product_id, least(coalesce(selected_product.stock_quantity, 0), coalesce(branch_stock, 0));
    end if;

    unit_price := case
      when p_price_mode = 'wholesale' and coalesce(selected_product.wholesale_price, 0) > 0
        then selected_product.wholesale_price
      when p_price_mode = 'wholesale'
        then round(selected_product.sale_price * 0.90, 2)
      else selected_product.sale_price
    end;
    line_base := round(unit_price * item.quantity, 2);
    line_discount := least(line_base, item.discount_amount);
    products_subtotal := products_subtotal + line_base;
    total_discount := total_discount + line_discount;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_repair_ids, '[]'::jsonb)) as requested(value)
    where requested.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'INVALID_REPAIR_LIST';
  end if;

  if jsonb_array_length(coalesce(p_repair_ids, '[]'::jsonb)) > 0 then
    if exists (
      select 1
      from jsonb_array_elements_text(p_repair_ids) as requested(value)
      left join public.repairs repair on repair.id = requested.value::uuid
      where repair.id is null
        or repair.organization_id <> p_organization_id
        or repair.branch_id <> p_branch_id
    ) then
      raise exception 'REPAIR_NOT_IN_POS_SCOPE';
    end if;

    select coalesce(sum(coalesce(repair.final_cost, repair.estimated_cost, 0)), 0)
    into repairs_subtotal
    from public.repairs repair
    where repair.id in (select value::uuid from jsonb_array_elements_text(p_repair_ids));
  end if;

  products_net := round(products_subtotal - total_discount, 2);
  p_order_discount_rate := least(100, greatest(0, coalesce(p_order_discount_rate, 0)));
  order_discount := round(products_net * p_order_discount_rate / 100, 2);
  products_net := products_net - order_discount;
  total_discount := total_discount + order_discount;
  net_subtotal := round(products_net + repairs_subtotal, 2);
  if net_subtotal <= 0 then
    raise exception 'POS_TOTAL_MUST_BE_POSITIVE';
  end if;

  p_tax_rate := least(100, greatest(0, coalesce(p_tax_rate, 0)));
  tax_amount := case when p_tax_rate = 0 then 0 else
    (case when p_prices_include_tax
      then round(products_net * p_tax_rate / (100 + p_tax_rate), 2)
      else round(products_net * p_tax_rate / 100, 2)
    end) + round(repairs_subtotal * p_tax_rate / (100 + p_tax_rate), 2)
  end;
  sale_total := round(
    (case when p_prices_include_tax
      then products_net
      else products_net + round(products_net * p_tax_rate / 100, 2)
    end) + repairs_subtotal,
    2
  );

  for payment in
    select
      payment_entry.ordinality - 1 as payment_index,
      lower(trim(payment_entry.value->>'payment_method')) as payment_method,
      round((payment_entry.value->>'amount')::numeric, 2) as amount,
      nullif(trim(payment_entry.value->>'reference'), '') as reference,
      nullif(trim(payment_entry.value->>'card_last4'), '') as card_last4
    from jsonb_array_elements(p_payments) with ordinality as payment_entry(value, ordinality)
  loop
    if payment.payment_method not in ('cash', 'card', 'transfer', 'credit') or payment.amount <= 0 then
      raise exception 'INVALID_POS_PAYMENT';
    end if;
    if payment.payment_method = 'card' and payment.card_last4 is not null
       and payment.card_last4 !~ '^[0-9]{4}$' then
      raise exception 'INVALID_CARD_REFERENCE';
    end if;
    if payment.payment_method = 'transfer' and payment.reference is null then
      raise exception 'TRANSFER_REFERENCE_REQUIRED';
    end if;
    payments_total := payments_total + payment.amount;
    payment_count := payment_count + 1;
    if payment.payment_method = 'credit' then
      credit_base := credit_base + payment.amount;
    end if;
  end loop;

  if abs(payments_total - sale_total) > 0.01 then
    raise exception 'PAYMENT_TOTAL_MISMATCH|%|%', sale_total, payments_total;
  end if;
  if credit_base > 0 and p_customer_id is null then
    raise exception 'CREDIT_CUSTOMER_REQUIRED';
  end if;

  payment_method_summary := case
    when payment_count > 1 then 'mixed'
    else (select case lower(trim(value->>'payment_method'))
      when 'cash' then 'efectivo'
      when 'card' then 'tarjeta'
      when 'transfer' then 'transferencia'
      else 'credit'
    end from jsonb_array_elements(p_payments) limit 1)
  end;

  insert into public.sales (
    id, organization_id, branch_id, idempotency_key, code, customer_id, created_by,
    subtotal_amount, total_amount, tax_amount, discount_amount, payment_method,
    payment_status, status, notes, created_at, updated_at
  ) values (
    created_sale_id, p_organization_id, p_branch_id, trim(p_idempotency_key), trim(p_code),
    p_customer_id, p_actor_id, products_subtotal + repairs_subtotal, sale_total,
    tax_amount, total_discount, payment_method_summary, 'completed', 'completed',
    nullif(trim(p_notes), ''), now(), now()
  );

  insert into public.sale_items (
    sale_id, product_id, quantity, unit_price, discount_amount, subtotal, organization_id
  )
  select
    created_sale_id,
    product.id,
    grouped.quantity,
    case
      when p_price_mode = 'wholesale' and coalesce(product.wholesale_price, 0) > 0 then product.wholesale_price
      when p_price_mode = 'wholesale' then round(product.sale_price * 0.90, 2)
      else product.sale_price
    end,
    least(
      round((case
        when p_price_mode = 'wholesale' and coalesce(product.wholesale_price, 0) > 0 then product.wholesale_price
        when p_price_mode = 'wholesale' then product.sale_price * 0.90
        else product.sale_price
      end) * grouped.quantity, 2),
      grouped.discount_amount
    ),
    round((case
      when p_price_mode = 'wholesale' and coalesce(product.wholesale_price, 0) > 0 then product.wholesale_price
      when p_price_mode = 'wholesale' then product.sale_price * 0.90
      else product.sale_price
    end) * grouped.quantity, 2) - least(
      round((case
        when p_price_mode = 'wholesale' and coalesce(product.wholesale_price, 0) > 0 then product.wholesale_price
        when p_price_mode = 'wholesale' then product.sale_price * 0.90
        else product.sale_price
      end) * grouped.quantity, 2),
      grouped.discount_amount
    ),
    p_organization_id
  from (
    select
      (value->>'product_id')::uuid as product_id,
      sum((value->>'quantity')::integer)::integer as quantity,
      sum(greatest(0, coalesce((value->>'discount_amount')::numeric, 0))) as discount_amount
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    group by (value->>'product_id')::uuid
  ) grouped
  join public.products product on product.id = grouped.product_id;

  for item in
    select
      (value->>'product_id')::uuid as product_id,
      sum((value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    group by (value->>'product_id')::uuid
  loop
    update public.products
    set stock_quantity = stock_quantity - item.quantity, updated_at = now()
    where id = item.product_id and organization_id = p_organization_id;

    update public.branch_inventory
    set stock_quantity = stock_quantity - item.quantity, updated_at = now()
    where branch_id = p_branch_id and product_id = item.product_id;
  end loop;

  for payment in
    select
      payment_entry.ordinality - 1 as payment_index,
      lower(trim(payment_entry.value->>'payment_method')) as payment_method,
      round((payment_entry.value->>'amount')::numeric, 2) as amount,
      nullif(trim(payment_entry.value->>'reference'), '') as reference,
      nullif(trim(payment_entry.value->>'card_last4'), '') as card_last4
    from jsonb_array_elements(p_payments) with ordinality as payment_entry(value, ordinality)
  loop
    insert into public.sale_payments (
      organization_id, sale_id, payment_index, payment_method, amount,
      reference, card_last4, status, created_by
    ) values (
      p_organization_id, created_sale_id, payment.payment_index, payment.payment_method,
      payment.amount, payment.reference, payment.card_last4, 'completed', p_actor_id
    );

    if payment.payment_method <> 'credit' then
      insert into public.cash_movements (
        session_id, type, amount, reason, payment_method, created_by, created_at,
        organization_id, branch_id, sale_id, payment_index
      ) values (
        p_session_id, 'sale', payment.amount, 'Venta ' || created_sale_id::text,
        payment.payment_method, p_actor_id, now(), p_organization_id, p_branch_id,
        created_sale_id, payment.payment_index
      );
    end if;
  end loop;

  if credit_base > 0 then
    select coalesce(customer.credit_limit, 0) into credit_limit
    from public.customers customer
    where customer.id = p_customer_id and customer.organization_id = p_organization_id
    for update;

    select coalesce(sum(greatest(0, installment.amount - coalesce(installment.amount_paid, 0))), 0)
    into current_credit_balance
    from public.customer_credits credit
    join public.credit_installments installment on installment.credit_id = credit.id
    where credit.organization_id = p_organization_id
      and credit.customer_id = p_customer_id
      and installment.status in ('pending', 'late');

    credit_rate := least(100, greatest(0, coalesce((p_credit->>'interest_rate')::numeric, 0)));
    credit_count := least(60, greatest(1, coalesce((p_credit->>'installment_count')::integer, 1)));
    credit_frequency := case p_credit->>'frequency'
      when 'weekly' then 'weekly'
      when 'biweekly' then 'biweekly'
      else 'monthly'
    end;
    financed_total := round(credit_base * (1 + credit_rate / 100), 2);
    available_credit := credit_limit - current_credit_balance;

    if credit_limit <= 0 or available_credit < financed_total then
      raise exception 'CREDIT_LIMIT_EXCEEDED|%', greatest(0, available_credit);
    end if;

    insert into public.customer_credits (
      customer_id, organization_id, branch_id, sale_id, principal, interest_rate,
      term_months, start_date, status, credit_code, credit_type, origin_type, label, metadata
    ) values (
      p_customer_id, p_organization_id, p_branch_id, created_sale_id, financed_total,
      credit_rate, credit_count, now(), 'active',
      'CR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'product_financing', 'sale', 'Venta ' || trim(p_code), '{}'::jsonb
    ) returning id into created_credit_id;

    installment_base := trunc((financed_total / credit_count) * 100) / 100;
    principal_base := trunc((credit_base / credit_count) * 100) / 100;

    for installment_index in 1..credit_count loop
      installment_due := case credit_frequency
        when 'weekly' then now() + make_interval(days => 7 * installment_index)
        when 'biweekly' then now() + make_interval(days => 14 * installment_index)
        else now() + make_interval(months => installment_index)
      end;

      insert into public.credit_installments (
        credit_id, sale_id, installment_number, due_date, amount,
        principal_component, interest_component, status
      ) values (
        created_credit_id,
        created_sale_id,
        installment_index,
        installment_due,
        case when installment_index = credit_count
          then financed_total - installment_base * (credit_count - 1)
          else installment_base end,
        case when installment_index = credit_count
          then credit_base - principal_base * (credit_count - 1)
          else principal_base end,
        case when installment_index = credit_count
          then (financed_total - credit_base) - (installment_base - principal_base) * (credit_count - 1)
          else installment_base - principal_base end,
        'pending'
      );
    end loop;
  end if;

  if jsonb_array_length(coalesce(p_repair_ids, '[]'::jsonb)) > 0 then
    update public.repairs repair
    set
      problem_description = trim(coalesce(repair.problem_description, ''))
        || E'\n\nVenta relacionada #' || created_sale_id::text
        || ' (' || payment_method_summary || ') por ' || sale_total::text || '.',
      payment_status = 'pagado',
      paid_amount = coalesce(repair.final_cost, repair.estimated_cost, 0),
      status = case when p_mark_repairs_delivered then 'entregado' else repair.status end,
      picked_up_at = case when p_mark_repairs_delivered then now() else repair.picked_up_at end,
      delivered_at = case when p_mark_repairs_delivered then now() else repair.delivered_at end,
      completed_at = case when p_mark_repairs_delivered then now() else repair.completed_at end,
      delivery_outcome = case when p_mark_repairs_delivered then p_delivery_outcome else repair.delivery_outcome end,
      updated_at = now()
    where repair.id in (select value::uuid from jsonb_array_elements_text(p_repair_ids))
      and repair.organization_id = p_organization_id
      and repair.branch_id = p_branch_id;
  end if;

  update public.cash_closures
  set last_activity_at = now(), updated_at = now()
  where id = p_session_id and organization_id = p_organization_id;

  return jsonb_build_object(
    'sale_id', created_sale_id,
    'idempotent', false,
    'total', sale_total,
    'subtotal', products_subtotal + repairs_subtotal,
    'discount', total_discount,
    'tax', tax_amount,
    'payment_method', payment_method_summary,
    'credit_id', created_credit_id
  );
end;
$$;

revoke all on function public.process_pos_sale_atomic_v2(
  uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text,
  numeric, boolean, jsonb, jsonb, boolean, text
) from public, anon, authenticated;
grant execute on function public.process_pos_sale_atomic_v2(
  uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text,
  numeric, boolean, jsonb, jsonb, boolean, text
) to service_role;

commit;
