-- ───────────────────────────────────────────────────────────────────────────
-- El POS no podía vender: la función de venta no tenía permiso
--
-- `/api/pos/process-sale` llama a la función con la clave de servicio —es la
-- forma de que la venta se procese con la organización y la sucursal ya
-- validadas por la API, sin depender de la sesión del navegador—. Pero las dos
-- últimas versiones se publicaron con:
--
--   revoke all ... from public;
--   grant execute ... to authenticated;
--
-- sin `service_role`. La v3 sí lo tenía, así que el problema entró con la v4
-- (saldo a favor) y quedó con la v5 (variantes): desde entonces cada cobro
-- terminaba en «permission denied for function process_pos_sale_atomic_v5» y
-- el mostrador veía un error 500 sin explicación.
--
-- No se vendió nada de más ni de menos: la función nunca llegó a ejecutarse,
-- así que ninguna venta quedó a medias.
-- ───────────────────────────────────────────────────────────────────────────

begin;

grant execute on function public.process_pos_sale_atomic_v4(
  uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text,
  numeric, boolean, jsonb, jsonb, boolean, text, numeric
) to service_role;

grant execute on function public.process_pos_sale_atomic_v5(
  uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text,
  numeric, boolean, jsonb, jsonb, boolean, text, numeric
) to service_role;

commit;
