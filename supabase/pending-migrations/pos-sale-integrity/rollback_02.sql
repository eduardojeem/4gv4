-- Reversión de 02: el snapshot vuelve a tomar siempre el costo del producto.

begin;

CREATE OR REPLACE FUNCTION "public"."capture_sale_item_cost_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  sale_organization_id uuid;
  sale_branch_id uuid;
  captured_product_id uuid;
  captured_unit_cost numeric(14, 2);
begin
  select sale.organization_id, sale.branch_id, product.id, nullif(product.purchase_price, 0)
  into sale_organization_id, sale_branch_id, captured_product_id, captured_unit_cost
  from public.sales sale
  left join public.products product
    on product.id = new.product_id
   and product.organization_id = sale.organization_id
  where sale.id = new.sale_id
    and sale.organization_id = new.organization_id;

  if sale_organization_id is null or sale_branch_id is null then
    raise exception 'SALE_ITEM_COST_SNAPSHOT_SCOPE_MISMATCH';
  end if;

  if new.product_id is not null and captured_product_id is null then
    raise exception 'SALE_ITEM_COST_SNAPSHOT_PRODUCT_SCOPE_MISMATCH';
  end if;

  insert into public.sale_item_cost_snapshots (
    organization_id,
    branch_id,
    sale_id,
    sale_item_id,
    product_id,
    quantity,
    unit_cost,
    total_cost
  ) values (
    sale_organization_id,
    sale_branch_id,
    new.sale_id,
    new.id,
    new.product_id,
    new.quantity,
    captured_unit_cost,
    case
      when captured_unit_cost is null then null
      else round(captured_unit_cost * new.quantity, 2)
    end
  )
  on conflict (organization_id, sale_item_id) do nothing;

  return new;
end;
$$;

commit;
