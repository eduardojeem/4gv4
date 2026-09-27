alter table public.repair_parts
  add column if not exists unit_price numeric(12, 2);

update public.repair_parts
set unit_price = unit_cost
where unit_price is null;

alter table public.repair_parts
  alter column unit_price set not null;

create or replace function public.replace_repair_parts_with_inventory(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_parts jsonb,
  p_actor_id uuid default null,
  p_labor_cost numeric default null,
  p_final_cost numeric default null,
  p_estimated_cost numeric default null,
  p_pricing_mode text default null,
  p_discount_amount numeric default null,
  p_price_override_reason text default null,
  p_pricing_updated_by uuid default null
)
returns table(parts_cost numeric, parts_price numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  old_item record;
  resolved_product_id uuid;
  resolved_name text;
  resolved_quantity integer;
  resolved_unit_price numeric;
  resolved_unit_cost numeric;
  available_stock integer;
  previous_stock integer;
  direct_cost_total numeric := 0;
  charged_price_total numeric := 0;
begin
  if jsonb_typeof(coalesce(p_parts, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_REPAIR_PARTS';
  end if;

  if jsonb_array_length(coalesce(p_parts, '[]'::jsonb)) > 100 then
    raise exception 'TOO_MANY_REPAIR_PARTS';
  end if;

  perform 1
  from public.repairs repair
  where repair.id = p_repair_id
    and repair.organization_id = p_organization_id
    and repair.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'REPAIR_NOT_FOUND';
  end if;

  -- Lock every inventory row that can be restored or consumed in a stable
  -- order. This prevents concurrent repairs from overselling the same item.
  perform 1
  from public.branch_inventory inventory
  where inventory.branch_id = p_branch_id
    and inventory.product_id in (
      select product_id
      from public.repair_parts
      where repair_id = p_repair_id
        and product_id is not null
      union
      select (value->>'product_id')::uuid
      from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb))
      where nullif(value->>'product_id', '') is not null
    )
  order by inventory.product_id
  for update;

  -- Editing replaces the complete list. Return previously consumed stock
  -- before validating and consuming the replacement list.
  for old_item in
    select product_id, sum(quantity)::integer as quantity
    from public.repair_parts
    where repair_id = p_repair_id
      and product_id is not null
    group by product_id
    order by product_id
  loop
    select coalesce(stock_quantity, 0)
      into previous_stock
    from public.branch_inventory
    where branch_id = p_branch_id
      and product_id = old_item.product_id
    for update;

    if not found then
      raise exception 'REPAIR_INVENTORY_ROW_MISSING|%', old_item.product_id;
    end if;

    update public.branch_inventory
    set stock_quantity = previous_stock + old_item.quantity,
        updated_at = now()
    where branch_id = p_branch_id
      and product_id = old_item.product_id;

    insert into public.product_movements (
      product_id, movement_type, quantity, previous_stock, new_stock,
      reference_id, reference_type, notes, user_id, branch_id,
      organization_id, created_at
    ) values (
      old_item.product_id, 'return', old_item.quantity, previous_stock,
      previous_stock + old_item.quantity, p_repair_id, 'repair',
      'Reposicion automatica al editar repuestos de reparacion',
      p_actor_id, p_branch_id, p_organization_id, now()
    );
  end loop;

  delete from public.repair_parts where repair_id = p_repair_id;

  for item in
    select value from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb))
  loop
    resolved_name := trim(coalesce(item->>'part_name', ''));
    resolved_quantity := (item->>'quantity')::integer;
    resolved_unit_price := (item->>'unit_price')::numeric;
    resolved_unit_cost := coalesce(nullif(item->>'unit_cost', '')::numeric, resolved_unit_price);
    resolved_product_id := nullif(item->>'product_id', '')::uuid;

    if resolved_name = '' or resolved_quantity <= 0 or resolved_unit_price < 0 or resolved_unit_cost < 0 then
      raise exception 'INVALID_REPAIR_PART';
    end if;

    if resolved_product_id is not null then
      select coalesce(product.purchase_price, 0)
        into resolved_unit_cost
      from public.products product
      where product.id = resolved_product_id
        and product.organization_id = p_organization_id
        and product.is_active = true;

      if not found then
        raise exception 'REPAIR_PRODUCT_NOT_FOUND|%', resolved_product_id;
      end if;

      select coalesce(stock_quantity, 0)
        into available_stock
      from public.branch_inventory
      where branch_id = p_branch_id
        and product_id = resolved_product_id
      for update;

      if not found or available_stock < resolved_quantity then
        raise exception 'REPAIR_STOCK_CHANGED|%|%', resolved_product_id, coalesce(available_stock, 0);
      end if;

      update public.branch_inventory
      set stock_quantity = available_stock - resolved_quantity,
          updated_at = now()
      where branch_id = p_branch_id
        and product_id = resolved_product_id;

      insert into public.product_movements (
        product_id, movement_type, quantity, previous_stock, new_stock,
        unit_cost, total_cost, reference_id, reference_type, notes,
        user_id, branch_id, organization_id, created_at
      ) values (
        resolved_product_id, 'repair_use', resolved_quantity, available_stock,
        available_stock - resolved_quantity, resolved_unit_cost,
        resolved_unit_cost * resolved_quantity, p_repair_id, 'repair',
        'Consumo en reparacion', p_actor_id, p_branch_id,
        p_organization_id, now()
      );
    end if;

    insert into public.repair_parts (
      repair_id, product_id, part_name, part_number, quantity,
      unit_cost, unit_price, supplier, status
    ) values (
      p_repair_id,
      resolved_product_id,
      resolved_name,
      nullif(trim(coalesce(item->>'part_number', '')), ''),
      resolved_quantity,
      resolved_unit_cost,
      resolved_unit_price,
      nullif(trim(coalesce(item->>'supplier', '')), ''),
      'installed'
    );

    direct_cost_total := direct_cost_total + (resolved_unit_cost * resolved_quantity);
    charged_price_total := charged_price_total + (resolved_unit_price * resolved_quantity);
  end loop;

  update public.repairs
  set parts_cost = direct_cost_total,
      labor_cost = coalesce(p_labor_cost, labor_cost),
      final_cost = coalesce(p_final_cost, final_cost),
      estimated_cost = coalesce(p_estimated_cost, estimated_cost),
      pricing_mode = coalesce(p_pricing_mode, pricing_mode),
      discount_amount = coalesce(p_discount_amount, discount_amount),
      price_override_reason = case
        when p_pricing_mode is not null then p_price_override_reason
        else price_override_reason
      end,
      pricing_updated_by = coalesce(p_pricing_updated_by, pricing_updated_by),
      pricing_updated_at = case when p_pricing_mode is not null then now() else pricing_updated_at end,
      updated_at = now()
  where id = p_repair_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id;

  return query select direct_cost_total, charged_price_total;
end;
$$;

revoke all on function public.replace_repair_parts_with_inventory(uuid, uuid, uuid, jsonb, uuid, numeric, numeric, numeric, text, numeric, text, uuid) from public;
revoke all on function public.replace_repair_parts_with_inventory(uuid, uuid, uuid, jsonb, uuid, numeric, numeric, numeric, text, numeric, text, uuid) from anon;
revoke all on function public.replace_repair_parts_with_inventory(uuid, uuid, uuid, jsonb, uuid, numeric, numeric, numeric, text, numeric, text, uuid) from authenticated;
grant execute on function public.replace_repair_parts_with_inventory(uuid, uuid, uuid, jsonb, uuid, numeric, numeric, numeric, text, numeric, text, uuid) to service_role;

create or replace function public.delete_repair_with_inventory(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_id uuid;
begin
  perform public.replace_repair_parts_with_inventory(
    p_repair_id,
    p_organization_id,
    p_branch_id,
    '[]'::jsonb,
    p_actor_id
  );

  delete from public.repairs
  where id = p_repair_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id
  returning id into deleted_id;

  return deleted_id is not null;
end;
$$;

revoke all on function public.delete_repair_with_inventory(uuid, uuid, uuid, uuid) from public;
revoke all on function public.delete_repair_with_inventory(uuid, uuid, uuid, uuid) from anon;
revoke all on function public.delete_repair_with_inventory(uuid, uuid, uuid, uuid) from authenticated;
grant execute on function public.delete_repair_with_inventory(uuid, uuid, uuid, uuid) to service_role;
