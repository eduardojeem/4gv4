-- Forward-only product integrity: tenant-safe references, atomic simple create, and unknown costs stay NULL.
BEGIN;
ALTER TABLE public.products ALTER COLUMN purchase_price DROP DEFAULT;
ALTER TABLE public.product_variants ALTER COLUMN purchase_price DROP NOT NULL;
ALTER TABLE public.product_variants ALTER COLUMN purchase_price DROP DEFAULT;
CREATE OR REPLACE FUNCTION public.save_product_with_variants(p_product jsonb, p_variants jsonb, p_branch_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
declare
  product_id uuid := coalesce(nullif(p_product->>'id', '')::uuid, gen_random_uuid());
  organization_id uuid := nullif(p_product->>'organization_id', '')::uuid;
  has_variants boolean := coalesce((p_product->>'has_variants')::boolean, false);
  variant_entry jsonb;
  saved_variant_id uuid;
  saved_variant_ids uuid[] := '{}'::uuid[];
  initial_stock integer;
  branch_organization_id uuid;
begin
  if organization_id is null or p_actor_id is null then
    raise exception 'VARIANT_PRODUCT_INVALID_INPUT';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_id
      and member.user_id = p_actor_id
      and member.status = 'active'
  ) then
    raise exception 'VARIANT_ACTOR_FORBIDDEN';
  end if;

  if nullif(p_product->>'category_id', '') is not null and not exists (
    select 1 from public.categories c where c.id = nullif(p_product->>'category_id', '')::uuid and c.organization_id = organization_id
  ) then raise exception 'VARIANT_PRODUCT_REFERENCE_FORBIDDEN'; end if;
  if nullif(p_product->>'supplier_id', '') is not null and not exists (
    select 1 from public.suppliers s where s.id = nullif(p_product->>'supplier_id', '')::uuid and s.organization_id = organization_id
  ) then raise exception 'VARIANT_PRODUCT_REFERENCE_FORBIDDEN'; end if;
  if nullif(p_product->>'brand_id', '') is not null and not exists (
    select 1 from public.brands b where b.id = nullif(p_product->>'brand_id', '')::uuid and b.organization_id = organization_id
  ) then raise exception 'VARIANT_PRODUCT_REFERENCE_FORBIDDEN'; end if;
  if jsonb_typeof(coalesce(p_variants, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_product->'variant_attribute_config', '[]'::jsonb)) <> 'array' then
    raise exception 'VARIANT_PRODUCT_INVALID_INPUT';
  end if;

  if has_variants and (p_branch_id is null or jsonb_array_length(p_variants) = 0) then
    raise exception 'VARIANT_PRODUCT_REQUIRES_VARIANTS';
  end if;

  if p_branch_id is not null then
    select branch.organization_id into branch_organization_id
    from public.branches branch
    where branch.id = p_branch_id;

    if branch_organization_id is distinct from organization_id then
      raise exception 'VARIANT_BRANCH_FORBIDDEN';
    end if;
  end if;

  insert into public.products (
    id,
    organization_id,
    name,
    sku,
    description,
    category_id,
    supplier_id,
    brand,
    brand_id,
    tags,
    purchase_price,
    sale_price,
    wholesale_price,
    stock_quantity,
    min_stock,
    max_stock,
    unit_measure,
    barcode,
    images,
    image_url,
    offer_price,
    has_offer,
    installments_enabled,
    installments_public,
    installments_plans,
    visibility,
    warranty_months,
    warranty_info,
    return_window_days,
    exchange_window_days,
    return_policy,
    exchange_policy,
    is_active,
    has_variants,
    variant_attribute_config
  ) values (
    product_id,
    organization_id,
    trim(p_product->>'name'),
    upper(trim(p_product->>'sku')),
    nullif(trim(p_product->>'description'), ''),
    nullif(p_product->>'category_id', '')::uuid,
    nullif(p_product->>'supplier_id', '')::uuid,
    nullif(trim(p_product->>'brand'), ''),
    nullif(p_product->>'brand_id', '')::uuid,
    case
      when jsonb_typeof(p_product->'tags') = 'array'
        then array(select jsonb_array_elements_text(p_product->'tags'))
      else null
    end,
    nullif(p_product->>'purchase_price', '')::numeric,
    coalesce((p_product->>'sale_price')::numeric, 0),
    nullif(p_product->>'wholesale_price', '')::numeric,
    case when has_variants then 0 else coalesce((p_product->>'stock_quantity')::integer, 0) end,
    coalesce((p_product->>'min_stock')::integer, 0),
    coalesce((p_product->>'max_stock')::integer, 1000),
    coalesce(nullif(trim(p_product->>'unit_measure'), ''), 'unidad'),
    nullif(trim(p_product->>'barcode'), ''),
    case
      when jsonb_typeof(p_product->'images') = 'array'
        then array(select jsonb_array_elements_text(p_product->'images'))
      else null
    end,
    nullif(trim(p_product->>'image_url'), ''),
    nullif(p_product->>'offer_price', '')::numeric,
    coalesce((p_product->>'has_offer')::boolean, false),
    coalesce((p_product->>'installments_enabled')::boolean, false),
    coalesce((p_product->>'installments_public')::boolean, true),
    coalesce(p_product->'installments_plans', '[]'::jsonb),
    coalesce(nullif(trim(p_product->>'visibility'), ''), 'public'),
    coalesce(nullif(p_product->>'warranty_months', '')::integer, 0),
    nullif(trim(p_product->>'warranty_info'), ''),
    coalesce(nullif(p_product->>'return_window_days', '')::integer, 0),
    coalesce(nullif(p_product->>'exchange_window_days', '')::integer, 0),
    nullif(trim(p_product->>'return_policy'), ''),
    nullif(trim(p_product->>'exchange_policy'), ''),
    coalesce((p_product->>'is_active')::boolean, true),
    has_variants,
    coalesce(p_product->'variant_attribute_config', '[]'::jsonb)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    sku = excluded.sku,
    description = excluded.description,
    category_id = excluded.category_id,
    supplier_id = excluded.supplier_id,
    brand = excluded.brand,
    brand_id = excluded.brand_id,
    tags = excluded.tags,
    purchase_price = excluded.purchase_price,
    sale_price = excluded.sale_price,
    wholesale_price = excluded.wholesale_price,
    min_stock = excluded.min_stock,
    max_stock = excluded.max_stock,
    unit_measure = excluded.unit_measure,
    barcode = excluded.barcode,
    images = excluded.images,
    image_url = excluded.image_url,
    offer_price = excluded.offer_price,
    has_offer = excluded.has_offer,
    installments_enabled = excluded.installments_enabled,
    installments_public = excluded.installments_public,
    installments_plans = excluded.installments_plans,
    visibility = excluded.visibility,
    warranty_months = excluded.warranty_months,
    warranty_info = excluded.warranty_info,
    return_window_days = excluded.return_window_days,
    exchange_window_days = excluded.exchange_window_days,
    return_policy = excluded.return_policy,
    exchange_policy = excluded.exchange_policy,
    is_active = excluded.is_active,
    has_variants = excluded.has_variants,
    variant_attribute_config = excluded.variant_attribute_config,
    updated_at = now()
  where products.organization_id = excluded.organization_id;

  if not found then
    raise exception 'VARIANT_PRODUCT_NOT_IN_ORGANIZATION';
  end if;

  delete from public.product_variant_attributes
  where product_variant_attributes.organization_id = organization_id
    and product_variant_attributes.product_id = product_id;

  insert into public.product_variant_attributes (
    organization_id,
    product_id,
    attribute_key,
    label,
    control,
    options,
    sort_order
  )
  select
    organization_id,
    product_id,
    trim(attribute.value->>'key'),
    trim(attribute.value->>'label'),
    attribute.value->>'control',
    coalesce(attribute.value->'options', '[]'::jsonb),
    attribute.ordinality - 1
  from jsonb_array_elements(coalesce(p_product->'variant_attribute_config', '[]'::jsonb))
    with ordinality as attribute(value, ordinality);

  if not has_variants then
    update public.product_variants
    set is_active = false,
        updated_at = now()
    where product_variants.organization_id = organization_id
      and product_variants.product_id = product_id;

    return jsonb_build_object('product_id', product_id, 'variant_ids', '[]'::jsonb);
  end if;

  for variant_entry in
    select value from jsonb_array_elements(p_variants)
  loop
    initial_stock := greatest(0, coalesce((variant_entry->>'stock_quantity')::integer, 0));
    saved_variant_id := coalesce(nullif(variant_entry->>'id', '')::uuid, gen_random_uuid());

    insert into public.product_variants (
      id,
      organization_id,
      product_id,
      variant_name,
      attributes,
      sku,
      barcode,
      purchase_price,
      sale_price,
      wholesale_price,
      min_stock,
      stock_quantity,
      price_adjustment,
      is_active
    ) values (
      saved_variant_id,
      organization_id,
      product_id,
      trim(variant_entry->>'name'),
      coalesce(variant_entry->'attributes', '{}'::jsonb),
      nullif(upper(trim(variant_entry->>'sku')), ''),
      nullif(trim(variant_entry->>'barcode'), ''),
      nullif(variant_entry->>'purchase_price', '')::numeric,
      coalesce((variant_entry->>'sale_price')::numeric, 0),
      nullif(variant_entry->>'wholesale_price', '')::numeric,
      greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0)),
      initial_stock,
      coalesce((variant_entry->>'sale_price')::numeric, 0)
        - coalesce((p_product->>'sale_price')::numeric, 0),
      coalesce((variant_entry->>'is_active')::boolean, true)
    )
    on conflict (id) do update
    set
      variant_name = excluded.variant_name,
      attributes = excluded.attributes,
      sku = excluded.sku,
      barcode = excluded.barcode,
      purchase_price = excluded.purchase_price,
      sale_price = excluded.sale_price,
      wholesale_price = excluded.wholesale_price,
      min_stock = excluded.min_stock,
      price_adjustment = excluded.price_adjustment,
      is_active = excluded.is_active,
      updated_at = now()
    where product_variants.organization_id = excluded.organization_id
      and product_variants.product_id = excluded.product_id;

    if not found then
      raise exception 'VARIANT_PRODUCT_MISMATCH';
    end if;

    saved_variant_ids := array_append(saved_variant_ids, saved_variant_id);

    insert into public.branch_variant_inventory (
      organization_id,
      branch_id,
      product_id,
      variant_id,
      stock_quantity,
      min_stock
    ) values (
      organization_id,
      p_branch_id,
      product_id,
      saved_variant_id,
      initial_stock,
      greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0))
    )
    on conflict on constraint branch_variant_inventory_pkey do nothing;

    if found and initial_stock > 0 then
      insert into public.variant_inventory_movements (
        organization_id,
        branch_id,
        product_id,
        variant_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        idempotency_key,
        reason,
        actor_id,
        metadata
      ) values (
        organization_id,
        p_branch_id,
        product_id,
        saved_variant_id,
        'initial',
        initial_stock,
        0,
        initial_stock,
        'variant-initial:' || p_branch_id::text || ':' || saved_variant_id::text,
        'Stock inicial de la variante',
        p_actor_id,
        '{}'::jsonb
      ) on conflict on constraint variant_inventory_movements_organization_id_idempotency_key_key do nothing;
    end if;

    update public.branch_variant_inventory
    set min_stock = greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0)),
        updated_at = now()
    where branch_variant_inventory.organization_id = organization_id
      and branch_variant_inventory.branch_id = p_branch_id
      and branch_variant_inventory.variant_id = saved_variant_id;
  end loop;

  update public.product_variants
  set is_active = false,
      updated_at = now()
  where product_variants.organization_id = organization_id
    and product_variants.product_id = product_id
    and not (product_variants.id = any(saved_variant_ids));

  return jsonb_build_object(
    'product_id', product_id,
    'variant_ids', to_jsonb(saved_variant_ids)
  );
exception
  when unique_violation then
    if sqlerrm ilike '%barcode%' then
      raise exception 'VARIANT_BARCODE_DUPLICATE';
    end if;
    raise exception 'VARIANT_SKU_DUPLICATE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_simple_product_atomic(p_product jsonb, p_branch_id uuid, p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
declare
  organization_id uuid := nullif(p_product->>'organization_id', '')::uuid;
  product_id uuid := gen_random_uuid();
  initial_stock integer := greatest(0, coalesce(nullif(p_product->>'stock_quantity', '')::integer, 0));
  default_branch_id uuid;
  global_stock integer;
begin
  if organization_id is null or p_actor_id is null then raise exception 'PRODUCT_INVALID_INPUT'; end if;
  if not exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = p_actor_id and m.status = 'active') then
    raise exception 'PRODUCT_ACTOR_FORBIDDEN';
  end if;
  if nullif(p_product->>'category_id', '') is not null and not exists (
    select 1 from public.categories c where c.id = nullif(p_product->>'category_id', '')::uuid and c.organization_id = organization_id
  ) then raise exception 'PRODUCT_REFERENCE_FORBIDDEN'; end if;
  if nullif(p_product->>'supplier_id', '') is not null and not exists (
    select 1 from public.suppliers s where s.id = nullif(p_product->>'supplier_id', '')::uuid and s.organization_id = organization_id
  ) then raise exception 'PRODUCT_REFERENCE_FORBIDDEN'; end if;
  if nullif(p_product->>'brand_id', '') is not null and not exists (
    select 1 from public.brands b where b.id = nullif(p_product->>'brand_id', '')::uuid and b.organization_id = organization_id
  ) then raise exception 'PRODUCT_REFERENCE_FORBIDDEN'; end if;
  if p_branch_id is not null and not exists (select 1 from public.branches b where b.id = p_branch_id and b.organization_id = organization_id) then
    raise exception 'PRODUCT_BRANCH_FORBIDDEN';
  end if;
  select b.id into default_branch_id from public.branches b where b.organization_id = organization_id and b.is_default is true order by b.id limit 1;
  if initial_stock > 0 and p_branch_id is null then raise exception 'PRODUCT_BRANCH_REQUIRED'; end if;
  global_stock := case when p_branch_id is null or p_branch_id = default_branch_id then initial_stock else 0 end;

  insert into public.products (
    id, organization_id, name, sku, description, category_id, supplier_id, brand, brand_id, tags,
    stock_quantity, min_stock, max_stock, purchase_price, sale_price, wholesale_price, offer_price, has_offer,
    installments_enabled, installments_public, installments_plans, is_active, visibility, warranty_months,
    warranty_info, return_window_days, exchange_window_days, return_policy, exchange_policy, images, image_url,
    barcode, unit_measure, featured, hide_price, price_currency, foreign_sale_price, foreign_wholesale_price,
    foreign_purchase_price, tax_rate, device_brand, device_models
  ) values (
    product_id, organization_id, trim(p_product->>'name'), upper(trim(p_product->>'sku')),
    nullif(trim(p_product->>'description'), ''), nullif(p_product->>'category_id', '')::uuid,
    nullif(p_product->>'supplier_id', '')::uuid, nullif(trim(p_product->>'brand'), ''), nullif(p_product->>'brand_id', '')::uuid,
    case when jsonb_typeof(p_product->'tags') = 'array' then array(select jsonb_array_elements_text(p_product->'tags')) else null end,
    global_stock, coalesce(nullif(p_product->>'min_stock', '')::integer, 0), coalesce(nullif(p_product->>'max_stock', '')::integer, 1000),
    nullif(p_product->>'purchase_price', '')::numeric, coalesce(nullif(p_product->>'sale_price', '')::numeric, 0),
    nullif(p_product->>'wholesale_price', '')::numeric, nullif(p_product->>'offer_price', '')::numeric,
    coalesce((p_product->>'has_offer')::boolean, false), coalesce((p_product->>'installments_enabled')::boolean, false),
    coalesce((p_product->>'installments_public')::boolean, true), coalesce(p_product->'installments_plans', '[]'::jsonb),
    coalesce((p_product->>'is_active')::boolean, true), coalesce(nullif(p_product->>'visibility', ''), 'public'),
    coalesce(nullif(p_product->>'warranty_months', '')::integer, 0), nullif(trim(p_product->>'warranty_info'), ''),
    coalesce(nullif(p_product->>'return_window_days', '')::integer, 0), coalesce(nullif(p_product->>'exchange_window_days', '')::integer, 0),
    nullif(trim(p_product->>'return_policy'), ''), nullif(trim(p_product->>'exchange_policy'), ''),
    case when jsonb_typeof(p_product->'images') = 'array' then array(select jsonb_array_elements_text(p_product->'images')) else null end,
    nullif(trim(p_product->>'image_url'), ''), nullif(trim(p_product->>'barcode'), ''),
    coalesce(nullif(trim(p_product->>'unit_measure'), ''), 'unidad'), coalesce((p_product->>'featured')::boolean, false),
    coalesce((p_product->>'hide_price')::boolean, false), nullif(p_product->>'price_currency', ''),
    nullif(p_product->>'foreign_sale_price', '')::numeric, nullif(p_product->>'foreign_wholesale_price', '')::numeric,
    nullif(p_product->>'foreign_purchase_price', '')::numeric, nullif(p_product->>'tax_rate', '')::numeric,
    nullif(trim(p_product->>'device_brand'), ''),
    case when jsonb_typeof(p_product->'device_models') = 'array' then array(select jsonb_array_elements_text(p_product->'device_models')) else '{}'::text[] end
  );

  if p_branch_id is not null then
    insert into public.branch_inventory (branch_id, product_id, stock_quantity)
    values (p_branch_id, product_id, initial_stock)
    on conflict on constraint inventario_sucursal_pk do update set stock_quantity = excluded.stock_quantity;
  end if;

  if initial_stock > 0 then
    insert into public.product_movements (
      product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id,
      notes, user_id, branch_id, organization_id
    ) values (
      product_id, 'initial', initial_stock, 0, initial_stock, 'product_creation', product_id,
      'Stock inicial al crear producto', p_actor_id, p_branch_id, organization_id
    );
  end if;

  if initial_stock > 0 and nullif(p_product->'initial_batch'->>'expires_on', '') is not null then
    insert into public.product_batches (organization_id, product_id, lot_code, expires_on, quantity, created_by)
    values (organization_id, product_id, nullif(trim(p_product->'initial_batch'->>'lot_code'), ''),
      (p_product->'initial_batch'->>'expires_on')::date, initial_stock, p_actor_id);
  end if;
  return jsonb_build_object('product_id', product_id);
end;
$function$;

REVOKE ALL ON FUNCTION public.create_simple_product_atomic(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_simple_product_atomic(jsonb, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.save_product_with_variants(jsonb, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_product_with_variants(jsonb, jsonb, uuid, uuid) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products GROUP BY lower(trim(sku)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'PRODUCT_SKU_CASE_INSENSITIVE_DUPLICATES: resolve duplicate normalized SKUs before applying this migration';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_normalized_unique ON public.products (lower(trim(sku)));
COMMIT;
