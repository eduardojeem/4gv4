-- ───────────────────────────────────────────────────────────────────────────
-- Vender una variante fallaba: la columna se llama `variant_name`
--
-- La v5 copia el nombre de la variante al renglón de la venta con `v.name`,
-- pero `product_variants` no tiene `name`: tiene `variant_name`. Cualquier
-- cobro que incluyera una variante moría con «column v.name does not exist»
-- (42703) y el mostrador veía un 500.
--
-- Se arregla con una reescritura mínima sobre la definición viva, para no
-- perder nada de lo que se haya parchado encima (el calendario de cuotas, por
-- ejemplo, se aplica con la misma técnica). Si el texto no está donde se
-- espera, la migración falla en vez de dejar la función a medias.
-- ───────────────────────────────────────────────────────────────────────────

begin;

do $migration$
declare
  objetivo regprocedure := 'public.process_pos_sale_atomic_v5(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric)'::regprocedure;
  definicion text := pg_get_functiondef(objetivo);
begin
  -- Ya corregida: no se toca.
  if strpos(definicion, 'g.variant_id,v.variant_name,v.sku') > 0 then return; end if;

  if strpos(definicion, 'g.variant_id,v.name,v.sku') = 0 then
    raise exception 'No se encontró el select de la variante; la función cambió y hay que revisarla a mano.';
  end if;

  definicion := replace(definicion, 'g.variant_id,v.name,v.sku', 'g.variant_id,v.variant_name,v.sku');
  execute definicion;
end
$migration$;

-- La reescritura vuelve a crear la función: los permisos se reafirman.
revoke all on function public.process_pos_sale_atomic_v5(
  uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric
) from public;
grant execute on function public.process_pos_sale_atomic_v5(
  uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text,numeric
) to authenticated, service_role;

commit;
