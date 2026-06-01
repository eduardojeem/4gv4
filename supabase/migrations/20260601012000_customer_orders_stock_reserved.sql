-- Track whether a customer order has already reserved product stock.
alter table public.customer_orders
  add column if not exists stock_reserved boolean not null default false;

create or replace function public.increment_product_stock(
  p_product_id uuid,
  p_organization_id uuid,
  p_quantity integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity <= 0 then
    return false;
  end if;

  update public.products
     set stock_quantity = coalesce(stock_quantity, 0) + p_quantity,
         updated_at = now()
   where id = p_product_id
     and organization_id = p_organization_id;

  return found;
end;
$$;

grant execute on function public.increment_product_stock(uuid, uuid, integer) to service_role;

comment on function public.increment_product_stock is
  'Atomically restores stock_quantity for a product. Returns FALSE when the product is not found.';
