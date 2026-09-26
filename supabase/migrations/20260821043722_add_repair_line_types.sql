alter table public.repair_parts
  add column if not exists line_type text not null default 'charged_part';

alter table public.repair_cost_revision_parts
  add column if not exists line_type_snapshot text not null default 'charged_part';

alter table public.repair_cost_revisions
  add column if not exists services_subtotal numeric(14, 2) not null default 0,
  add column if not exists charged_parts_subtotal numeric(14, 2) not null default 0,
  add column if not exists included_materials_internal_cost numeric(14, 2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'repair_parts_line_type_check') then
    alter table public.repair_parts add constraint repair_parts_line_type_check
      check (line_type in ('service', 'included_material', 'charged_part'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'repair_cost_revision_parts_line_type_check') then
    alter table public.repair_cost_revision_parts add constraint repair_cost_revision_parts_line_type_check
      check (line_type_snapshot in ('service', 'included_material', 'charged_part'));
  end if;
end;
$$;

create or replace function public.save_repair_cost_revision(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_labor_amount numeric,
  p_parts jsonb,
  p_additional_charges numeric,
  p_deductions numeric,
  p_discount_amount numeric,
  p_override_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_revision public.repair_cost_revisions%rowtype;
  membership_role text;
  is_admin boolean := false;
  customer_is_wholesale boolean := false;
  max_discount_percent numeric := 20;
  labor_tax_rate numeric := 10;
  normalized_labor numeric := round(coalesce(p_labor_amount, 0), 2);
  normalized_charges numeric := round(coalesce(p_additional_charges, 0), 2);
  normalized_deductions numeric := round(coalesce(p_deductions, 0), 2);
  normalized_discount numeric := round(coalesce(p_discount_amount, 0), 2);
  normalized_reason text := nullif(trim(coalesce(p_override_reason, '')), '');
  normalized_parts jsonb := coalesce(p_parts, '[]'::jsonb);
  request_hash text;
  item jsonb;
  old_item record;
  resolved_parts jsonb := '[]'::jsonb;
  resolved_line_type text;
  resolved_product_id uuid;
  resolved_name text;
  resolved_part_number text;
  resolved_supplier text;
  resolved_quantity integer;
  resolved_unit_price numeric;
  resolved_unit_cost numeric;
  resolved_part_discount numeric;
  resolved_tax_rate numeric;
  resolved_subtotal numeric;
  product_unit_measure text;
  product_sale_price numeric;
  product_wholesale_price numeric;
  previous_stock integer;
  available_stock integer;
  services_subtotal numeric := 0;
  charged_parts_subtotal numeric := 0;
  included_materials_internal_cost numeric := 0;
  parts_internal_cost numeric := 0;
  subtotal_before_discount numeric := 0;
  final_total numeric := 0;
  paid_snapshot numeric := 0;
  balance_snapshot numeric := 0;
  discount_percent numeric := 0;
  tax_gross_0 numeric := 0;
  tax_gross_5 numeric := 0;
  tax_gross_10 numeric := 0;
  allocation_factor numeric := 0;
  tax_breakdown jsonb := '[]'::jsonb;
  policy_snapshot jsonb;
  previous_snapshot jsonb;
  new_revision_id uuid;
  new_revision_number integer;
  result_payload jsonb;
begin
  if jsonb_typeof(normalized_parts) <> 'array' or jsonb_array_length(normalized_parts) > 100 then
    raise exception 'INVALID_REPAIR_PARTS';
  end if;
  if normalized_labor < 0 or normalized_charges < 0 or normalized_deductions < 0
     or normalized_discount < 0 or trim(coalesce(p_idempotency_key, '')) = '' then
    raise exception 'INVALID_REPAIR_COST_INPUT';
  end if;

  request_hash := md5(jsonb_build_object(
    'repair_id', p_repair_id, 'labor', normalized_labor, 'parts', normalized_parts,
    'charges', normalized_charges, 'deductions', normalized_deductions,
    'discount', normalized_discount, 'reason', normalized_reason
  )::text);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));

  select * into existing_revision
  from public.repair_cost_revisions revision
  where revision.organization_id = p_organization_id
    and revision.idempotency_key = p_idempotency_key;
  if found then
    if existing_revision.intent_hash is distinct from request_hash then
      raise exception 'REPAIR_COST_IDEMPOTENCY_CONFLICT';
    end if;
    return existing_revision.result_snapshot;
  end if;

  select * into target_repair
  from public.repairs repair
  where repair.id = p_repair_id
    and repair.organization_id = p_organization_id
    and repair.branch_id = p_branch_id
  for update;
  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  if target_repair.status in ('entregado', 'cancelado') then raise exception 'REPAIR_COST_NOT_EDITABLE'; end if;

  select membership.role::text into membership_role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_id
    and membership.status = 'active';
  if membership_role is null then raise exception 'REPAIR_COST_FORBIDDEN'; end if;
  is_admin := membership_role in ('owner', 'admin', 'super_admin');

  select lower(coalesce(customer.customer_type, '')) in ('wholesale', 'mayorista')
  into customer_is_wholesale
  from public.customers customer
  where customer.id = target_repair.customer_id
    and customer.organization_id = p_organization_id;
  customer_is_wholesale := coalesce(customer_is_wholesale, false);

  select coalesce(settings.repair_max_discount_percent, 20),
         coalesce(settings.repair_labor_tax_rate, 10)
  into max_discount_percent, labor_tax_rate
  from public.organization_settings settings
  where settings.organization_id = p_organization_id;
  max_discount_percent := coalesce(max_discount_percent, 20);
  labor_tax_rate := coalesce(labor_tax_rate, 10);

  perform 1
  from public.branch_inventory inventory
  where inventory.branch_id = p_branch_id
    and inventory.product_id in (
      select part.product_id from public.repair_parts part
      where part.repair_id = p_repair_id and part.product_id is not null and part.line_type <> 'service'
      union
      select (value->>'product_id')::uuid
      from jsonb_array_elements(normalized_parts)
      where nullif(value->>'product_id', '') is not null
        and coalesce(value->>'line_type', 'charged_part') <> 'service'
    )
  order by inventory.product_id
  for update;

  for old_item in
    select product_id, sum(quantity)::integer quantity
    from public.repair_parts
    where repair_id = p_repair_id and product_id is not null and line_type <> 'service'
    group by product_id order by product_id
  loop
    select inventory.stock_quantity into previous_stock
    from public.branch_inventory inventory
    where inventory.branch_id = p_branch_id and inventory.product_id = old_item.product_id
    for update;
    if not found then raise exception 'REPAIR_INVENTORY_ROW_MISSING|%', old_item.product_id; end if;
    update public.branch_inventory
    set stock_quantity = previous_stock + old_item.quantity, updated_at = now()
    where branch_id = p_branch_id and product_id = old_item.product_id;
    insert into public.product_movements (
      product_id, movement_type, quantity, previous_stock, new_stock,
      reference_id, reference_type, notes, user_id, branch_id, organization_id, created_at
    ) values (
      old_item.product_id, 'return', old_item.quantity, previous_stock,
      previous_stock + old_item.quantity, p_repair_id, 'repair',
      'Reposicion automatica al editar costos de reparacion', p_actor_id,
      p_branch_id, p_organization_id, now()
    );
  end loop;

  for item in select value from jsonb_array_elements(normalized_parts)
  loop
    resolved_line_type := coalesce(nullif(item->>'line_type', ''), 'charged_part');
    if resolved_line_type not in ('service', 'included_material', 'charged_part') then
      raise exception 'INVALID_REPAIR_LINE_TYPE';
    end if;
    resolved_product_id := nullif(item->>'product_id', '')::uuid;
    resolved_name := trim(coalesce(item->>'part_name', ''));
    resolved_part_number := nullif(trim(coalesce(item->>'part_number', '')), '');
    resolved_supplier := nullif(trim(coalesce(item->>'supplier', '')), '');
    resolved_quantity := coalesce((item->>'quantity')::integer, 0);
    resolved_unit_price := round(coalesce((item->>'unit_price')::numeric, 0), 2);
    resolved_unit_cost := round(coalesce(nullif(item->>'unit_cost', '')::numeric, 0), 2);
    resolved_part_discount := round(coalesce((item->>'discount_amount')::numeric, 0), 2);
    resolved_tax_rate := coalesce(nullif(item->>'tax_rate', '')::numeric, labor_tax_rate);
    if resolved_name = '' or resolved_quantity <= 0 or resolved_unit_price < 0 or resolved_unit_cost < 0
       or resolved_part_discount < 0 or resolved_part_discount > resolved_unit_price * resolved_quantity
       or resolved_tax_rate not in (0, 5, 10) then raise exception 'INVALID_REPAIR_PART'; end if;

    if resolved_product_id is not null then
      select round(coalesce(product.purchase_price, 0), 2),
             round(coalesce(product.sale_price, 0), 2),
             round(coalesce(product.wholesale_price, 0), 2),
             coalesce(product.tax_rate, labor_tax_rate),
             lower(trim(coalesce(product.unit_measure, ''))), product.name, product.sku
      into resolved_unit_cost, product_sale_price, product_wholesale_price,
           resolved_tax_rate, product_unit_measure, resolved_name, resolved_part_number
      from public.products product
      where product.id = resolved_product_id
        and product.organization_id = p_organization_id and product.is_active = true
      for update;
      if not found then raise exception 'REPAIR_PRODUCT_NOT_FOUND|%', resolved_product_id; end if;

      if product_unit_measure = 'servicio' then
        resolved_line_type := 'service';
        resolved_unit_cost := 0;
        resolved_unit_price := case when customer_is_wholesale and product_wholesale_price > 0
          then product_wholesale_price else product_sale_price end;
      elsif resolved_line_type = 'service' then
        raise exception 'REPAIR_LINE_TYPE_MISMATCH';
      elsif resolved_line_type = 'included_material' then
        resolved_unit_price := 0;
        resolved_part_discount := 0;
      else
        resolved_line_type := 'charged_part';
        resolved_unit_price := case when customer_is_wholesale and product_wholesale_price > 0
          then product_wholesale_price else product_sale_price end;
      end if;
    elsif resolved_line_type = 'included_material' then
      resolved_unit_price := 0;
      resolved_part_discount := 0;
    end if;

    resolved_subtotal := round(resolved_unit_price * resolved_quantity - resolved_part_discount, 2);
    if resolved_line_type = 'charged_part' and resolved_subtotal / resolved_quantity < resolved_unit_cost then
      if not is_admin then raise exception 'REPAIR_PART_BELOW_COST'; end if;
      if normalized_reason is null or length(normalized_reason) < 5 then raise exception 'REPAIR_OVERRIDE_REASON_REQUIRED'; end if;
    end if;

    if resolved_line_type = 'service' then
      services_subtotal := services_subtotal + resolved_subtotal;
    elsif resolved_line_type = 'included_material' then
      included_materials_internal_cost := included_materials_internal_cost + resolved_unit_cost * resolved_quantity;
      parts_internal_cost := parts_internal_cost + resolved_unit_cost * resolved_quantity;
    else
      charged_parts_subtotal := charged_parts_subtotal + resolved_subtotal;
      parts_internal_cost := parts_internal_cost + resolved_unit_cost * resolved_quantity;
    end if;

    resolved_parts := resolved_parts || jsonb_build_array(jsonb_build_object(
      'line_type', resolved_line_type, 'product_id', resolved_product_id,
      'part_name', resolved_name, 'part_number', resolved_part_number,
      'supplier', resolved_supplier, 'quantity', resolved_quantity,
      'unit_price', resolved_unit_price, 'unit_cost', resolved_unit_cost,
      'discount_amount', resolved_part_discount, 'tax_rate', resolved_tax_rate,
      'subtotal', resolved_subtotal
    ));
  end loop;

  subtotal_before_discount := round(normalized_labor + services_subtotal + charged_parts_subtotal + normalized_charges, 2);
  if normalized_discount + normalized_deductions > subtotal_before_discount then raise exception 'REPAIR_DISCOUNT_EXCEEDS_SUBTOTAL'; end if;
  discount_percent := case when subtotal_before_discount = 0 then 0 else normalized_discount * 100 / subtotal_before_discount end;
  if discount_percent > max_discount_percent then
    if not is_admin then raise exception 'REPAIR_DISCOUNT_LIMIT_EXCEEDED'; end if;
    if normalized_reason is null or length(normalized_reason) < 5 then raise exception 'REPAIR_OVERRIDE_REASON_REQUIRED'; end if;
  end if;
  final_total := round(greatest(0, subtotal_before_discount - normalized_discount - normalized_deductions), 2);
  paid_snapshot := round(greatest(coalesce(target_repair.paid_amount, 0), 0), 2);
  if final_total < paid_snapshot then raise exception 'REPAIR_FINAL_BELOW_PAID_AMOUNT'; end if;
  balance_snapshot := round(greatest(final_total - paid_snapshot, 0), 2);
  allocation_factor := case when subtotal_before_discount = 0 then 0 else final_total / subtotal_before_discount end;

  if labor_tax_rate = 0 then tax_gross_0 := normalized_labor + normalized_charges;
  elsif labor_tax_rate = 5 then tax_gross_5 := normalized_labor + normalized_charges;
  else tax_gross_10 := normalized_labor + normalized_charges; end if;
  for item in select value from jsonb_array_elements(resolved_parts)
  loop
    if (item->>'subtotal')::numeric <= 0 then continue; end if;
    if (item->>'tax_rate')::numeric = 0 then tax_gross_0 := tax_gross_0 + (item->>'subtotal')::numeric;
    elsif (item->>'tax_rate')::numeric = 5 then tax_gross_5 := tax_gross_5 + (item->>'subtotal')::numeric;
    else tax_gross_10 := tax_gross_10 + (item->>'subtotal')::numeric; end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
    'rate', rate, 'grossAmount', gross_amount,
    'taxableBase', round(gross_amount / (1 + rate / 100), 2),
    'taxAmount', round(gross_amount - gross_amount / (1 + rate / 100), 2)
  ) order by rate), '[]'::jsonb)
  into tax_breakdown
  from (values
    (0::numeric, round(tax_gross_0 * allocation_factor, 2)),
    (5::numeric, round(tax_gross_5 * allocation_factor, 2)),
    (10::numeric, round(tax_gross_10 * allocation_factor, 2))
  ) buckets(rate, gross_amount)
  where gross_amount > 0;

  select coalesce(max(revision.revision_number), 0) + 1 into new_revision_number
  from public.repair_cost_revisions revision where revision.repair_id = p_repair_id;
  select jsonb_build_object(
    'laborAmount', revision.labor_amount, 'servicesSubtotal', revision.services_subtotal,
    'chargedPartsSubtotal', revision.charged_parts_subtotal,
    'includedMaterialsInternalCost', revision.included_materials_internal_cost,
    'partsSubtotal', revision.parts_subtotal, 'finalTotal', revision.final_total
  ) into previous_snapshot
  from public.repair_cost_revisions revision where revision.id = target_repair.current_cost_revision_id;
  policy_snapshot := jsonb_build_object(
    'maxDiscountPercent', max_discount_percent, 'laborTaxRate', labor_tax_rate,
    'customerIsWholesale', customer_is_wholesale,
    'administratorOverride', is_admin and normalized_reason is not null
  );

  new_revision_id := gen_random_uuid();
  result_payload := jsonb_build_object(
    'revisionId', new_revision_id, 'revisionNumber', new_revision_number,
    'summary', jsonb_build_object(
      'laborAmount', normalized_labor, 'servicesSubtotal', round(services_subtotal, 2),
      'chargedPartsSubtotal', round(charged_parts_subtotal, 2),
      'includedMaterialsInternalCost', round(included_materials_internal_cost, 2),
      'partsSubtotal', round(services_subtotal + charged_parts_subtotal, 2),
      'partsInternalCost', round(parts_internal_cost, 2),
      'additionalCharges', normalized_charges, 'deductions', normalized_deductions,
      'discountAmount', normalized_discount, 'subtotalBeforeDiscount', subtotal_before_discount,
      'finalTotal', final_total, 'paidAmount', paid_snapshot, 'balance', balance_snapshot,
      'taxBreakdown', tax_breakdown
    ), 'parts', resolved_parts
  );

  insert into public.repair_cost_revisions (
    id, organization_id, branch_id, repair_id, revision_number, actor_id, actor_role,
    reason, labor_amount, labor_tax_rate, services_subtotal, charged_parts_subtotal,
    included_materials_internal_cost, parts_subtotal, parts_internal_cost,
    additional_charges, deductions, discount_amount, subtotal_before_discount,
    final_total, paid_amount_snapshot, balance_snapshot, tax_breakdown,
    policy_snapshot, previous_snapshot, intent_hash, idempotency_key, result_snapshot
  ) values (
    new_revision_id, p_organization_id, p_branch_id, p_repair_id, new_revision_number,
    p_actor_id, membership_role, normalized_reason, normalized_labor, labor_tax_rate,
    round(services_subtotal, 2), round(charged_parts_subtotal, 2),
    round(included_materials_internal_cost, 2), round(services_subtotal + charged_parts_subtotal, 2),
    round(parts_internal_cost, 2), normalized_charges, normalized_deductions,
    normalized_discount, subtotal_before_discount, final_total, paid_snapshot,
    balance_snapshot, tax_breakdown, policy_snapshot, previous_snapshot,
    request_hash, p_idempotency_key, result_payload
  );

  delete from public.repair_parts where repair_id = p_repair_id;
  for item in select value from jsonb_array_elements(resolved_parts)
  loop
    resolved_line_type := item->>'line_type';
    resolved_product_id := nullif(item->>'product_id', '')::uuid;
    resolved_quantity := (item->>'quantity')::integer;
    resolved_unit_cost := (item->>'unit_cost')::numeric;
    if resolved_product_id is not null and resolved_line_type <> 'service' then
      select inventory.stock_quantity into available_stock
      from public.branch_inventory inventory
      where inventory.branch_id = p_branch_id and inventory.product_id = resolved_product_id
      for update;
      if not found or available_stock < resolved_quantity then
        raise exception 'REPAIR_STOCK_CHANGED|%|%', resolved_product_id, coalesce(available_stock, 0);
      end if;
      update public.branch_inventory set stock_quantity = available_stock - resolved_quantity, updated_at = now()
      where branch_id = p_branch_id and product_id = resolved_product_id;
      insert into public.product_movements (
        product_id, movement_type, quantity, previous_stock, new_stock, unit_cost,
        total_cost, reference_id, reference_type, notes, user_id, branch_id,
        organization_id, created_at
      ) values (
        resolved_product_id, 'repair_use', resolved_quantity, available_stock,
        available_stock - resolved_quantity, resolved_unit_cost,
        resolved_unit_cost * resolved_quantity, p_repair_id, 'repair',
        'Consumo al confirmar revision de costos', p_actor_id, p_branch_id,
        p_organization_id, now()
      );
    end if;
    insert into public.repair_parts (
      repair_id, product_id, part_name, part_number, quantity, unit_cost,
      unit_price, discount_amount, tax_rate, supplier, status, line_type
    ) values (
      p_repair_id, resolved_product_id, item->>'part_name', nullif(item->>'part_number', ''),
      resolved_quantity, resolved_unit_cost, (item->>'unit_price')::numeric,
      (item->>'discount_amount')::numeric, (item->>'tax_rate')::numeric,
      nullif(item->>'supplier', ''), 'installed', resolved_line_type
    );
    insert into public.repair_cost_revision_parts (
      revision_id, organization_id, branch_id, repair_id, product_id, part_name,
      part_number, supplier, quantity, unit_cost_snapshot, unit_price_snapshot,
      discount_amount, tax_rate, subtotal, line_type_snapshot
    ) values (
      new_revision_id, p_organization_id, p_branch_id, p_repair_id,
      resolved_product_id, item->>'part_name', nullif(item->>'part_number', ''),
      nullif(item->>'supplier', ''), resolved_quantity, resolved_unit_cost,
      (item->>'unit_price')::numeric, (item->>'discount_amount')::numeric,
      (item->>'tax_rate')::numeric, (item->>'subtotal')::numeric, resolved_line_type
    );
  end loop;

  update public.repairs set
    labor_cost = normalized_labor, parts_cost = round(parts_internal_cost, 2),
    additional_charges = normalized_charges, deductions = normalized_deductions,
    discount_amount = normalized_discount, final_cost = final_total,
    estimated_cost = final_total, pricing_mode = 'automatic',
    price_override_reason = normalized_reason, pricing_updated_by = p_actor_id,
    pricing_updated_at = now(), current_cost_revision_id = new_revision_id, updated_at = now()
  where id = p_repair_id and organization_id = p_organization_id and branch_id = p_branch_id;

  return result_payload;
end;
$$;

revoke all on function public.save_repair_cost_revision(uuid, uuid, uuid, uuid, numeric, jsonb, numeric, numeric, numeric, text, text) from public, anon, authenticated;
grant execute on function public.save_repair_cost_revision(uuid, uuid, uuid, uuid, numeric, jsonb, numeric, numeric, numeric, text, text) to service_role;

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
  operation jsonb;
  operation_key text;
begin
  operation_key := 'parts-replace-' || gen_random_uuid()::text;
  operation := public.save_repair_cost_revision(
    p_repair_id, p_organization_id, p_branch_id, coalesce(p_actor_id, p_pricing_updated_by),
    coalesce(p_labor_cost, 0), coalesce(p_parts, '[]'::jsonb), 0, 0,
    coalesce(p_discount_amount, 0), p_price_override_reason, operation_key
  );
  return query select
    coalesce((operation->'summary'->>'partsInternalCost')::numeric, 0),
    coalesce((operation->'summary'->>'servicesSubtotal')::numeric, 0)
      + coalesce((operation->'summary'->>'chargedPartsSubtotal')::numeric, 0);
end;
$$;

revoke all on function public.replace_repair_parts_with_inventory(uuid, uuid, uuid, jsonb, uuid, numeric, numeric, numeric, text, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.replace_repair_parts_with_inventory(uuid, uuid, uuid, jsonb, uuid, numeric, numeric, numeric, text, numeric, text, uuid) to service_role;
