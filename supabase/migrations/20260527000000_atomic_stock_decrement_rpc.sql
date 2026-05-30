-- Atomically decrement product stock when a public order is confirmed.
-- Uses SELECT FOR UPDATE so two simultaneous requests cannot both pass
-- the stock check and both subtract from the same quantity.
--
-- Returns TRUE  → decrement succeeded (stock was sufficient)
-- Returns FALSE → insufficient stock or product not found
--
-- Called by the /api/public/orders route (service-role key → bypasses RLS).

create or replace function public.decrement_product_stock(
  p_product_id     uuid,
  p_organization_id uuid,
  p_quantity        integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stock integer;
begin
  -- Lock the product row for the duration of this transaction.
  -- Any concurrent call for the same product will wait here.
  select stock_quantity
    into v_current_stock
    from public.products
   where id              = p_product_id
     and organization_id = p_organization_id
  for update;

  -- Product not found or stock insufficient → report failure
  if not found or v_current_stock < p_quantity then
    return false;
  end if;

  -- Safe to subtract — do it atomically inside the same transaction
  update public.products
     set stock_quantity = stock_quantity - p_quantity,
         updated_at     = now()
   where id              = p_product_id
     and organization_id = p_organization_id;

  return true;
end;
$$;

-- Grant execute only to service_role (used by the Next.js admin client)
grant execute on function public.decrement_product_stock(uuid, uuid, integer) to service_role;

comment on function public.decrement_product_stock is
  'Atomically checks and decrements stock_quantity for a product. Returns FALSE when stock is 0 or insufficient.';
