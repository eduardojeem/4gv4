-- Libera el stock de órdenes públicas abandonadas.
-- Al crear un pedido se descuenta el stock (stock_reserved=true, status=PENDING).
-- Si el pedido nunca se paga ni se cancela, el stock quedaba descontado para siempre.
-- Esta función expira los pedidos PENDING sin pagar con más de 72h, devuelve el stock
-- y los marca CANCELLED. Idempotente vía el flag stock_reserved.

create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_ids uuid[];
begin
  -- 1. Pedidos pendientes, sin pagar, con stock reservado y más viejos que 72h.
  select array_agg(id) into expired_ids
  from public.customer_orders
  where status = 'PENDING'
    and payment_status = 'PENDING'
    and stock_reserved = true
    and created_at < now() - interval '72 hours';

  if expired_ids is null or array_length(expired_ids, 1) is null then
    return 0;
  end if;

  -- 2. Devolver el stock (suma de cantidades por producto de esas órdenes).
  update public.products p
  set stock_quantity = stock_quantity + agg.qty,
      updated_at = now()
  from (
    select oi.product_id, sum(oi.quantity)::integer as qty
    from public.customer_order_items oi
    where oi.order_id = any(expired_ids)
      and oi.product_id is not null
    group by oi.product_id
  ) agg
  where p.id = agg.product_id;

  -- 3. Cancelar las órdenes y liberar la reserva.
  update public.customer_orders
  set status = 'CANCELLED',
      stock_reserved = false,
      cancelled_at = now(),
      updated_at = now()
  where id = any(expired_ids);

  -- 4. Registrar en el historial.
  insert into public.customer_order_status_history (organization_id, order_id, from_status, to_status, note)
  select organization_id, id, 'PENDING', 'CANCELLED', 'Expirada automáticamente por falta de pago (72h).'
  from public.customer_orders
  where id = any(expired_ids);

  return array_length(expired_ids, 1);
end;
$$;

grant execute on function public.expire_stale_orders() to service_role;

-- Cron cada hora.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('expire-stale-orders')
    where exists (select 1 from cron.job where jobname = 'expire-stale-orders');

    perform cron.schedule(
      'expire-stale-orders',
      '0 * * * *',
      'select public.expire_stale_orders()'
    );
  end if;
end $$;
