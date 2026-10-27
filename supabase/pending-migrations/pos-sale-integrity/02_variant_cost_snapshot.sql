-- Costo histórico de las variantes.
--
-- El snapshot de costo de cada línea tomaba siempre products.purchase_price.
-- Una variante con costo propio (product_variants.purchase_price) quedaba con el
-- costo del producto base, y el margen de esa venta era incorrecto para siempre
-- (el snapshot es inmutable). Ahora usa el costo de la variante si lo tiene y,
-- si no, el del producto. La oferta no interviene: el costo nunca cambia por el
-- precio de venta.
--
-- Va después de 01: hasta 01, las líneas con variante se insertaban sin
-- variant_id y este cambio no tendría efecto.

begin;

create or replace function public.capture_sale_item_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  sale_organization_id uuid;
  sale_branch_id uuid;
  captured_product_id uuid;
  captured_unit_cost numeric(14, 2);
begin
  select sale.organization_id, sale.branch_id, product.id,
    coalesce(nullif(variant.purchase_price, 0), nullif(product.purchase_price, 0))
  into sale_organization_id, sale_branch_id, captured_product_id, captured_unit_cost
  from public.sales sale
  left join public.products product
    on product.id = new.product_id
   and product.organization_id = sale.organization_id
  left join public.product_variants variant
    on variant.id = new.variant_id
   and variant.product_id = new.product_id
   and variant.organization_id = sale.organization_id
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

revoke all on function public.capture_sale_item_cost_snapshot() from public, anon, authenticated;

commit;
