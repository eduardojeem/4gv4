alter table public.customer_order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_name text;

create index if not exists customer_order_items_variant_idx
  on public.customer_order_items (organization_id, variant_id)
  where variant_id is not null;

create or replace function public.create_public_order_atomic(
  p_organization_id uuid, p_customer_id uuid, p_customer jsonb, p_order jsonb,
  p_items jsonb, p_promotion_id uuid default null
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  resolved_customer_id uuid := p_customer_id;
  created_order_id uuid;
  item record;
  available_stock integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ITEMS_REQUIRED';
  end if;
  if resolved_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = resolved_customer_id and c.organization_id = p_organization_id
  ) then raise exception 'CUSTOMER_NOT_IN_ORGANIZATION'; end if;

  for item in
    select (value->>'product_id')::uuid product_id,
      nullif(value->>'variant_id', '')::uuid variant_id,
      sum((value->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(p_items)
    group by (value->>'product_id')::uuid, nullif(value->>'variant_id', '')::uuid
    order by (value->>'product_id')::uuid, nullif(value->>'variant_id', '')::uuid nulls first
  loop
    if item.quantity <= 0 then raise exception 'INVALID_ORDER_QUANTITY'; end if;
    if item.variant_id is not null then
      update public.product_variants variant
      set stock_quantity = variant.stock_quantity - item.quantity, updated_at = now()
      where variant.id = item.variant_id and variant.product_id = item.product_id
        and variant.organization_id = p_organization_id and variant.is_active = true
        and variant.stock_quantity >= item.quantity;
      if not found then
        select coalesce(variant.stock_quantity, 0) into available_stock
        from public.product_variants variant
        where variant.id = item.variant_id and variant.product_id = item.product_id
          and variant.organization_id = p_organization_id;
        raise exception 'STOCK_CHANGED_VARIANT|%|%|%', item.product_id, item.variant_id, coalesce(available_stock, 0);
      end if;
    else
      if exists (
        select 1 from public.products product where product.id = item.product_id
          and product.organization_id = p_organization_id and product.has_variants = true
      ) then raise exception 'VARIANT_NOT_AVAILABLE'; end if;
      update public.products product
      set stock_quantity = product.stock_quantity - item.quantity, updated_at = now()
      where product.id = item.product_id and product.organization_id = p_organization_id
        and product.is_active = true and product.stock_quantity >= item.quantity;
      if not found then
        select coalesce(product.stock_quantity, 0) into available_stock from public.products product
        where product.id = item.product_id and product.organization_id = p_organization_id;
        raise exception 'STOCK_CHANGED|%|%', item.product_id, coalesce(available_stock, 0);
      end if;
    end if;
  end loop;

  if p_promotion_id is not null then
    update public.promotions set usage_count = usage_count + 1, updated_at = now()
    where id = p_promotion_id and organization_id = p_organization_id and is_active = true
      and (usage_limit is null or usage_count < usage_limit);
    if not found then raise exception 'PROMOTION_LIMIT_REACHED'; end if;
  end if;

  if resolved_customer_id is null then
    insert into public.customers (organization_id, name, email, phone, address, status, customer_type, created_at, updated_at)
    values (p_organization_id, p_customer->>'name', nullif(p_customer->>'email', ''),
      coalesce(p_customer->>'phone', ''), nullif(p_customer->>'address', ''), 'active', 'regular', now(), now())
    returning id into resolved_customer_id;
  end if;

  insert into public.customer_orders (
    organization_id, customer_id, order_number, status, payment_status, payment_method,
    fulfillment_type, customer_name, customer_email, customer_phone, customer_address,
    subtotal, shipping_cost, discount_amount, tax_amount, total, notes, stock_reserved, created_at, updated_at
  ) values (
    p_organization_id, resolved_customer_id, p_order->>'order_number', 'PENDING', 'PENDING',
    p_order->>'payment_method', p_order->>'fulfillment_type', p_customer->>'name',
    nullif(p_customer->>'email', ''), nullif(p_customer->>'phone', ''), nullif(p_customer->>'address', ''),
    (p_order->>'subtotal')::numeric, (p_order->>'shipping_cost')::numeric,
    (p_order->>'discount_amount')::numeric, 0, (p_order->>'total')::numeric,
    nullif(p_order->>'notes', ''), true, now(), now()
  ) returning id into created_order_id;

  insert into public.customer_order_items (
    organization_id, order_id, product_id, variant_id, variant_name, product_name,
    product_sku, quantity, unit_price, subtotal
  )
  select p_organization_id, created_order_id, (value->>'product_id')::uuid,
    nullif(value->>'variant_id', '')::uuid, nullif(value->>'variant_name', ''),
    value->>'product_name', nullif(value->>'product_sku', ''),
    (value->>'quantity')::integer, (value->>'unit_price')::numeric, (value->>'subtotal')::numeric
  from jsonb_array_elements(p_items);

  insert into public.customer_order_status_history (organization_id, order_id, to_status, note)
  values (p_organization_id, created_order_id, 'PENDING', 'Pedido creado desde la tienda publica.');
  return jsonb_build_object('order_id', created_order_id, 'customer_id', resolved_customer_id);
end;
$$;

create or replace function public.cancel_customer_order_atomic(
  p_organization_id uuid, p_order_id uuid, p_actor_id uuid default null, p_note text default null
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare order_row public.customer_orders%rowtype; released_amount numeric := 0;
begin
  select * into order_row from public.customer_orders customer_order
  where customer_order.id = p_order_id and customer_order.organization_id = p_organization_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status = 'CANCELLED' then
    return jsonb_build_object('order_id', order_row.id, 'from_status', order_row.status,
      'stock_released', false, 'store_credit_released', 0);
  end if;
  update public.customer_store_credit_reservations set status = 'released', released_at = now(), updated_at = now()
  where organization_id = p_organization_id and order_id = p_order_id and status = 'reserved'
  returning amount into released_amount;

  if order_row.stock_reserved then
    update public.product_variants variant
    set stock_quantity = variant.stock_quantity + quantities.quantity, updated_at = now()
    from (
      select order_item.variant_id, sum(order_item.quantity)::integer quantity
      from public.customer_order_items order_item
      where order_item.order_id = order_row.id and order_item.variant_id is not null
      group by order_item.variant_id
    ) quantities
    where variant.id = quantities.variant_id and variant.organization_id = p_organization_id;

    if order_row.branch_id is null then
      update public.products product set stock_quantity = product.stock_quantity + quantities.quantity, updated_at = now()
      from (
        select order_item.product_id, sum(order_item.quantity)::integer quantity
        from public.customer_order_items order_item
        where order_item.order_id = order_row.id and order_item.product_id is not null and order_item.variant_id is null
        group by order_item.product_id
      ) quantities
      where product.id = quantities.product_id and product.organization_id = p_organization_id;
    else
      update public.branch_inventory inventory set stock_quantity = inventory.stock_quantity + quantities.quantity, updated_at = now()
      from (
        select order_item.product_id, sum(order_item.quantity)::integer quantity
        from public.customer_order_items order_item
        where order_item.order_id = order_row.id and order_item.product_id is not null and order_item.variant_id is null
        group by order_item.product_id
      ) quantities
      where inventory.branch_id = order_row.branch_id and inventory.product_id = quantities.product_id;
    end if;
  end if;

  update public.customer_orders set status = 'CANCELLED', stock_reserved = false, store_credit_reserved = 0,
    cancelled_at = now(), updated_at = now()
  where id = order_row.id and organization_id = p_organization_id;
  insert into public.customer_order_status_history (organization_id, order_id, from_status, to_status, note, changed_by)
  values (p_organization_id, order_row.id, order_row.status, 'CANCELLED', p_note, p_actor_id);
  return jsonb_build_object('order_id', order_row.id, 'from_status', order_row.status,
    'stock_released', order_row.stock_reserved, 'store_credit_released', coalesce(released_amount, 0));
end;
$$;

revoke all on function public.create_public_order_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.cancel_customer_order_atomic(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_public_order_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.cancel_customer_order_atomic(uuid, uuid, uuid, text) to service_role;
