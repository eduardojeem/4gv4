-- Decremento atómico de stock para el POS (evita sobreventa por carrera).
-- El POS hacía stock = max(0, stock - qty) desde el cliente: dos ventas simultáneas
-- podían leer el mismo stock y ambas restar (lost update) → vender de más.
-- Este RPC bloquea la fila (FOR UPDATE), valida que el llamador sea staff de la org
-- del producto y que haya stock suficiente, y recién ahí descuenta.
--
-- Devuelve TRUE si descontó, FALSE si no hay stock suficiente / sin permiso / producto inexistente.

create or replace function public.pos_decrement_stock(p_product_id uuid, p_quantity integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    return false;
  end if;

  -- Bloquea la fila del producto y obtiene su organización + stock actual.
  select organization_id, stock_quantity
    into v_org, v_stock
  from public.products
  where id = p_product_id
  for update;

  if not found then
    return false;
  end if;

  -- El llamador debe ser staff activo (no cliente) de la org del producto.
  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = v_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role <> 'customer'
  ) then
    return false;
  end if;

  if coalesce(v_stock, 0) < p_quantity then
    return false;
  end if;

  update public.products
  set stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  where id = p_product_id;

  return true;
end;
$$;

grant execute on function public.pos_decrement_stock(uuid, integer) to authenticated;
