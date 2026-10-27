-- Reversión de 01. Devuelve v2 y v5 a su definición anterior.
-- ATENCIÓN: la definición anterior de v5 es la que hace fallar las ventas con
-- variantes. Usar solo si 01 causó un problema peor y con autorización.

begin;

do $migration$
declare
  source text;
begin
  select pg_get_functiondef(p.oid) into source
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'process_pos_sale_atomic_v2';
  -- Las funciones creadas desde archivos de Windows guardan CRLF: se compara
  -- y se reinstala con LF, que para PL/pgSQL es equivalente.
  source := replace(source, E'\r\n', E'\n');
  if position('products_tax numeric' in source) = 0 then
    raise notice 'v2 no tiene los cambios de 01: no se modifica.';
    return;
  end if;
  if position($new$  p_tax_rate := least(100, greatest(0, coalesce(p_tax_rate, 0)));
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
  );$new$ in source) = 0 then raise exception 'POS_V2_ROLLBACK_CONTRACT_CHANGED'; end if;
  source := replace(source, $new$  p_tax_rate := least(100, greatest(0, coalesce(p_tax_rate, 0)));
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
  );$new$, $old$  p_tax_rate := least(100, greatest(0, coalesce(p_tax_rate, 0)));
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
  );$old$);
  if position($new$  insert into public.sale_items (
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
  ) priced;$new$ in source) = 0 then raise exception 'POS_V2_ROLLBACK_CONTRACT_CHANGED'; end if;
  source := replace(source, $new$  insert into public.sale_items (
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
  ) priced;$new$, $old$  insert into public.sale_items (
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
  join public.products product on product.id = grouped.product_id;$old$);
  source := replace(source, E'  tax_amount numeric := 0;\n  products_tax numeric := 0;', '  tax_amount numeric := 0;');
  execute source;
end $migration$;

CREATE OR REPLACE FUNCTION "public"."process_pos_sale_atomic_v5"("p_organization_id" "uuid", "p_branch_id" "uuid", "p_actor_id" "uuid", "p_session_id" "uuid", "p_idempotency_key" "text", "p_code" "text", "p_customer_id" "uuid", "p_items" "jsonb", "p_payments" "jsonb", "p_price_mode" "text" DEFAULT 'retail'::"text", "p_order_discount_rate" numeric DEFAULT 0, "p_notes" "text" DEFAULT NULL::"text", "p_tax_rate" numeric DEFAULT 0, "p_prices_include_tax" boolean DEFAULT true, "p_credit" "jsonb" DEFAULT NULL::"jsonb", "p_repair_ids" "jsonb" DEFAULT '[]'::"jsonb", "p_mark_repairs_delivered" boolean DEFAULT false, "p_delivery_outcome" "text" DEFAULT NULL::"text", "p_store_credit_amount" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result jsonb; created_sale_id uuid; line record; variant_price numeric; parent_price numeric;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'INVALID_POS_ITEMS'; end if;

  for line in
    select (e.value->>'product_id')::uuid product_id, (e.value->>'variant_id')::uuid variant_id
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e(value)
    where nullif(e.value->>'variant_id', '') is not null
  loop
    select case when p_price_mode = 'wholesale' and coalesce(v.wholesale_price,0)>0 then v.wholesale_price else v.sale_price end,
           case when p_price_mode = 'wholesale' and coalesce(p.wholesale_price,0)>0 then p.wholesale_price
                when p_price_mode = 'wholesale' then round(p.sale_price*.90,2) else p.sale_price end
    into variant_price, parent_price
    from public.product_variants v join public.products p on p.id=v.product_id
    join public.branch_variant_inventory i on i.variant_id=v.id and i.branch_id=p_branch_id
    where v.id=line.variant_id and v.product_id=line.product_id
      and v.organization_id=p_organization_id and i.organization_id=p_organization_id and v.is_active=true;
    if not found then raise exception 'VARIANT_NOT_IN_POS_SCOPE'; end if;
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
      sum((e.value->>'quantity')::integer)::integer quantity,
      sum(greatest(0,coalesce((e.value->>'discount_amount')::numeric,0))) discount_amount
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e(value)
    where nullif(e.value->>'variant_id','') is not null
    group by 1,2 order by 1,2
  loop
    perform public.adjust_variant_stock_atomic(p_organization_id,p_branch_id,line.variant_id,-line.quantity,
      'sale','pos-sale:'||p_idempotency_key||':'||line.variant_id::text,p_actor_id,'sale',created_sale_id,'Venta POS',
      jsonb_build_object('sale_id',created_sale_id));
  end loop;

  delete from public.sale_items si where si.sale_id=created_sale_id and si.product_id in (
    select distinct (e.value->>'product_id')::uuid from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e(value)
    where nullif(e.value->>'variant_id','') is not null);

  insert into public.sale_items(sale_id,product_id,variant_id,variant_name,variant_sku,variant_attributes,
    quantity,unit_price,discount_amount,subtotal,organization_id)
  select created_sale_id,g.product_id,g.variant_id,v.variant_name,v.sku,v.attributes,g.quantity,
    case when p_price_mode='wholesale' and coalesce(v.wholesale_price,0)>0 then v.wholesale_price else v.sale_price end,
    least(g.discount_amount,round((case when p_price_mode='wholesale' and coalesce(v.wholesale_price,0)>0 then v.wholesale_price else v.sale_price end)*g.quantity,2)),
    round((case when p_price_mode='wholesale' and coalesce(v.wholesale_price,0)>0 then v.wholesale_price else v.sale_price end)*g.quantity,2)
      - least(g.discount_amount,round((case when p_price_mode='wholesale' and coalesce(v.wholesale_price,0)>0 then v.wholesale_price else v.sale_price end)*g.quantity,2)),
    p_organization_id
  from (
    select (e.value->>'product_id')::uuid product_id,(e.value->>'variant_id')::uuid variant_id,
      sum((e.value->>'quantity')::integer)::integer quantity,
      sum(greatest(0,coalesce((e.value->>'discount_amount')::numeric,0))) discount_amount
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e(value)
    where nullif(e.value->>'variant_id','') is not null group by 1,2
  ) g join public.product_variants v on v.id=g.variant_id;

  return result||jsonb_build_object('variants_processed',true);
end; $$;

commit;
