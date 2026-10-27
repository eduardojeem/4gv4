-- Verificación de solo lectura de la etapa pos-sale-integrity.

-- 1) Qué versión de cada función hay.
select p.proname,
  position('products_tax numeric' in pg_get_functiondef(p.oid)) > 0 as iva_por_producto,
  position('delete from public.sale_items' in pg_get_functiondef(p.oid)) > 0 as borra_lineas,
  position('pos_sale_item_unit_costs' in pg_get_functiondef(p.oid)) > 0 as costo_historico
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('process_pos_sale_atomic_v2', 'process_pos_sale_atomic_v5', 'dashboard_pos_summary_s1', 'capture_sale_item_cost_snapshot');

-- 2) Ventas con variantes de los últimos 30 días: cada línea con variante tiene
--    su snapshot de costo y su atribución de comisión.
select si.sale_id, si.id as sale_item_id, si.variant_id, si.quantity,
  (select count(*) from public.sale_item_cost_snapshots c where c.sale_item_id = si.id) as snapshots,
  (select count(*) from public.commission_sale_item_attributions a where a.sale_item_id = si.id) as atribuciones
from public.sale_items si
join public.sales s on s.id = si.sale_id
where si.variant_id is not null and s.created_at > now() - interval '30 days'
order by s.created_at desc
limit 50;

-- 3) Atribuciones de comisión huérfanas (líneas borradas): deberían ser 0.
select count(*) as atribuciones_huerfanas
from public.commission_sale_item_attributions a
where not exists (select 1 from public.sale_items si where si.id = a.sale_item_id);

-- 4) Ventas recientes con céntimos en el total (en guaraníes deberían ser 0).
select count(*) as ventas_con_centimos
from public.sales
where created_at > now() - interval '30 days'
  and total_amount <> round(total_amount);
