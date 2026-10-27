-- POS: líneas por variante sin borrar filas, e IVA por producto.
--
-- 1) Venta con variantes. process_pos_sale_atomic_v5 llamaba a v4 (que vía v2
--    inserta UNA línea por producto) y después BORRABA esas líneas para
--    reinsertarlas por variante. El borrado choca con
--    sale_item_cost_snapshots_sale_item_id_fkey (ON DELETE RESTRICT, snapshots
--    inmutables) y con commission_sale_item_attributions (solo agregar): toda
--    venta con variante fallaba. Ahora v2 inserta directamente una línea por
--    (producto, variante) con sus datos, y v5 solo valida y descuenta el stock
--    de la variante.
--
-- 2) IVA por producto. v2 calculaba el IVA de toda la venta con una sola tasa e
--    ignoraba products.tax_rate (0, 5 o 10). Con precios con IVA incluido el
--    total no cambia: solo el IVA informado. Con precios sin IVA se mantiene la
--    tasa única, porque el total depende de la tasa y el POS todavía la calcula
--    así; cambiarla solo acá haría rechazar cobros por diferencia de total.
--
-- No reescribe v2 a mano: toma su definición vigente, reemplaza tres bloques
-- exactos y aborta si alguno no está (la función cambió y hay que revisarla).
-- Los dos cambios van en la misma transacción: v2 nueva con v5 vieja, o al
-- revés, deja ventas con variantes rotas o sin datos de variante.

begin;

-- Reemplaza un bloque de una definición de función comparando el código y no
-- los espacios: producción puede tener espacios al final de línea o \r\n que
-- el repo no tiene. Si el bloque no está, aborta con el código indicado.
create or replace function pg_temp.pos_stage_replace(source text, old_block text, new_block text, tag text)
returns text language plpgsql as $helper$
declare
  pattern text;
  matched text;
begin
  -- Sin los bordes: un \s+ inicial se tragaría el salto de línea anterior.
  pattern := regexp_replace(btrim(old_block, E' \t\r\n'), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
  pattern := regexp_replace(pattern, '\s+', '\\s+', 'g');
  matched := substring(source from pattern);
  if matched is null then raise exception '%', tag; end if;
  return replace(source, matched, btrim(new_block, E' \t\r\n'));
end $helper$;

do $migration$
declare
  source text;
  old_block text;
  new_block text;
begin
  select pg_get_functiondef(p.oid) into source
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'process_pos_sale_atomic_v2';
  -- Las funciones creadas desde archivos de Windows guardan CRLF: se compara
  -- y se reinstala con LF, que para PL/pgSQL es equivalente.
  source := replace(source, E'\r\n', E'\n');
  if source is null then raise exception 'POS_V2_MISSING'; end if;
  if position('products_tax numeric' in source) > 0 then
    raise notice 'process_pos_sale_atomic_v2 ya tiene IVA por producto: no se modifica.';
    return;
  end if;

  -- Variable para el IVA de productos.
  old_block := '  tax_amount numeric := 0;';
  if position(old_block in source) = 0 then raise exception 'POS_V2_CONTRACT_CHANGED|declare'; end if;
  source := replace(source, old_block, old_block || E'\n  products_tax numeric := 0;');

  -- IVA: por producto cuando los precios incluyen IVA.
  old_block := $old$  p_tax_rate := least(100, greatest(0, coalesce(p_tax_rate, 0)));
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
  );$old$;
  new_block := $new$  p_tax_rate := least(100, greatest(0, coalesce(p_tax_rate, 0)));
  if p_prices_include_tax then
    -- IVA contenido de cada producto con su tasa (0, 5 o 10); sin tasa propia,
    -- la de la organización. El descuento general se reparte en proporción.
    select coalesce(sum(case when lines.rate = 0 then 0
      else round(lines.net * lines.rate / (100 + lines.rate), 2) end), 0)
    into products_tax
    from (
      select
        (priced.line_base - least(priced.line_base, grouped.discount_amount))
          * (1 - p_order_discount_rate / 100) as net,
        least(100, greatest(0, coalesce(product.tax_rate, p_tax_rate))) as rate
      from (
        select
          (value->>'product_id')::uuid as product_id,
          sum((value->>'quantity')::integer)::integer as quantity,
          sum(greatest(0, coalesce((value->>'discount_amount')::numeric, 0))) as discount_amount
        from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
        group by (value->>'product_id')::uuid
      ) grouped
      join public.products product
        on product.id = grouped.product_id and product.organization_id = p_organization_id
      cross join lateral (
        select round((case
          when p_price_mode = 'wholesale' and coalesce(product.wholesale_price, 0) > 0 then product.wholesale_price
          when p_price_mode = 'wholesale' then round(product.sale_price * 0.90, 2)
          else product.sale_price
        end) * grouped.quantity, 2) as line_base
      ) priced
    ) lines;
  else
    -- Sin IVA incluido el total depende de la tasa: se mantiene la única.
    products_tax := round(products_net * p_tax_rate / 100, 2);
  end if;
  tax_amount := products_tax
    + case when p_tax_rate = 0 then 0 else round(repairs_subtotal * p_tax_rate / (100 + p_tax_rate), 2) end;
  sale_total := round(
    (case when p_prices_include_tax
      then products_net
      else products_net + products_tax
    end) + repairs_subtotal,
    2
  );$new$;
  source := pg_temp.pos_stage_replace(source, old_block, new_block, 'POS_V2_CONTRACT_CHANGED|tax');

  -- Líneas: una por (producto, variante), con los datos de la variante.
  old_block := $old$  insert into public.sale_items (
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
  join public.products product on product.id = grouped.product_id;$old$;
  -- v5 ya validó que el precio de la variante es el del producto, así que el
  -- precio unitario sale del producto como antes. El precio mayorista de
  -- respaldo se redondea igual que en el cálculo del total.
  new_block := $new$  insert into public.sale_items (
    sale_id, product_id, variant_id, variant_name, variant_sku, variant_attributes,
    quantity, unit_price, discount_amount, subtotal, organization_id
  )
  select
    created_sale_id,
    product.id,
    variant.id,
    variant.variant_name,
    variant.sku,
    variant.attributes,
    grouped.quantity,
    priced.unit_price,
    least(round(priced.unit_price * grouped.quantity, 2), grouped.discount_amount),
    round(priced.unit_price * grouped.quantity, 2)
      - least(round(priced.unit_price * grouped.quantity, 2), grouped.discount_amount),
    p_organization_id
  from (
    select
      (value->>'product_id')::uuid as product_id,
      nullif(value->>'variant_id', '')::uuid as variant_id,
      sum((value->>'quantity')::integer)::integer as quantity,
      sum(greatest(0, coalesce((value->>'discount_amount')::numeric, 0))) as discount_amount
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    group by (value->>'product_id')::uuid, nullif(value->>'variant_id', '')::uuid
  ) grouped
  join public.products product on product.id = grouped.product_id
  left join public.product_variants variant
    on variant.id = grouped.variant_id
   and variant.product_id = grouped.product_id
   and variant.organization_id = p_organization_id
  cross join lateral (
    select case
      when p_price_mode = 'wholesale' and coalesce(product.wholesale_price, 0) > 0 then product.wholesale_price
      when p_price_mode = 'wholesale' then round(product.sale_price * 0.90, 2)
      else product.sale_price
    end as unit_price
  ) priced;$new$;
  source := pg_temp.pos_stage_replace(source, old_block, new_block, 'POS_V2_CONTRACT_CHANGED|sale_items');

  execute source;
end $migration$;

-- v5: valida la variante y descuenta su stock. Ya no borra ni reinserta líneas.
-- En mayorista, una variante sin precio mayorista propio hereda el del producto
-- (antes se comparaba su precio de lista contra el mayorista del producto y la
-- venta fallaba con VARIANT_PRICE_REQUIRES_SYNC).
create or replace function public.process_pos_sale_atomic_v5(
  p_organization_id uuid, p_branch_id uuid, p_actor_id uuid, p_session_id uuid,
  p_idempotency_key text, p_code text, p_customer_id uuid, p_items jsonb,
  p_payments jsonb, p_price_mode text default 'retail', p_order_discount_rate numeric default 0,
  p_notes text default null, p_tax_rate numeric default 0, p_prices_include_tax boolean default true,
  p_credit jsonb default null, p_repair_ids jsonb default '[]'::jsonb,
  p_mark_repairs_delivered boolean default false, p_delivery_outcome text default null,
  p_store_credit_amount numeric default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; created_sale_id uuid; line record; variant_price numeric; parent_price numeric;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'INVALID_POS_ITEMS'; end if;

  for line in
    select (e.value->>'product_id')::uuid product_id, (e.value->>'variant_id')::uuid variant_id
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e(value)
    where nullif(e.value->>'variant_id', '') is not null
  loop
    select case when p_price_mode = 'wholesale' and coalesce(p.wholesale_price,0)>0 then p.wholesale_price
                when p_price_mode = 'wholesale' then round(p.sale_price*.90,2) else p.sale_price end
    into parent_price
    from public.product_variants v join public.products p on p.id=v.product_id
    join public.branch_variant_inventory i on i.variant_id=v.id and i.branch_id=p_branch_id
    where v.id=line.variant_id and v.product_id=line.product_id
      and v.organization_id=p_organization_id and i.organization_id=p_organization_id and v.is_active=true;
    if not found then raise exception 'VARIANT_NOT_IN_POS_SCOPE'; end if;
    select case when p_price_mode = 'wholesale'
                then coalesce(nullif(v.wholesale_price,0), parent_price)
                else v.sale_price end
    into variant_price
    from public.product_variants v where v.id=line.variant_id;
    if variant_price is distinct from parent_price then raise exception 'VARIANT_PRICE_REQUIRES_SYNC'; end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) a(value)
    join jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) b(value)
      on a.value->>'product_id'=b.value->>'product_id'
    where nullif(a.value->>'variant_id','') is null and nullif(b.value->>'variant_id','') is not null
  ) then raise exception 'POS_VARIANT_MIXED_WITH_PARENT'; end if;

  result := public.process_pos_sale_atomic_v4(
    p_organization_id,p_branch_id,p_actor_id,p_session_id,p_idempotency_key,p_code,p_customer_id,
    p_items,p_payments,p_price_mode,p_order_discount_rate,p_notes,p_tax_rate,p_prices_include_tax,
    p_credit,p_repair_ids,p_mark_repairs_delivered,p_delivery_outcome,p_store_credit_amount);
  if coalesce((result->>'idempotent')::boolean,false) then return result; end if;
  created_sale_id := (result->>'sale_id')::uuid;

  for line in
    select (e.value->>'product_id')::uuid product_id, (e.value->>'variant_id')::uuid variant_id,
      sum((e.value->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e(value)
    where nullif(e.value->>'variant_id','') is not null
    group by 1,2 order by 1,2
  loop
    perform public.adjust_variant_stock_atomic(p_organization_id,p_branch_id,line.variant_id,-line.quantity,
      'sale','pos-sale:'||p_idempotency_key||':'||line.variant_id::text,p_actor_id,'sale',created_sale_id,'Venta POS',
      jsonb_build_object('sale_id',created_sale_id));
  end loop;

  return result||jsonb_build_object('variants_processed',true);
end; $$;

revoke all on function public.process_pos_sale_atomic_v5(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric) from public, anon, authenticated;
-- Igual que en 20260927111905_harden_database_function_access: solo el servidor.
grant execute on function public.process_pos_sale_atomic_v5(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric) to service_role;

commit;
