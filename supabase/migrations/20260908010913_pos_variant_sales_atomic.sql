begin;

-- POS v4 sigue siendo la fuente canónica para totales, caja, crédito e
-- inventario agregado. Esta función añade el inventario y snapshot de la
-- variante dentro de la misma transacción.
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
  select created_sale_id,g.product_id,g.variant_id,v.name,v.sku,v.attributes,g.quantity,
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

revoke all on function public.process_pos_sale_atomic_v5(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric) from public;
grant execute on function public.process_pos_sale_atomic_v5(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric) to authenticated;

commit;
