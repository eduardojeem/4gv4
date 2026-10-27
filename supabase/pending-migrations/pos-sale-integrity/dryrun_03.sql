-- PRUEBA EN SECO de 03_dashboard_net_and_historical_cost.sql: ejecuta todo, incluida la compilación de la
-- función parchada, y al final deshace con ROLLBACK. No cambia nada.
-- Si termina sin error (y muestra el aviso de abajo), el archivo real aplica.

-- Resumen del POS: ventas sin IVA y costo histórico.
--
-- 1) netSales («Ventas sin IVA») sumaba sales.subtotal_amount, que el POS
--    guarda como el bruto ANTES de descuentos y con el IVA incluido. Con un
--    descuento, «sin IVA» salía mayor que «con IVA». Ahora es total − IVA.
-- 2) El costo de mercadería usaba el costo ACTUAL del producto: editar un costo
--    hoy cambiaba el margen de ventas pasadas. Ahora usa el snapshot inmutable
--    de cada línea (sale_item_cost_snapshots) y, si esa línea no tenía costo
--    al venderse, cae al costo actual como antes.
--
-- Los snapshots tienen RLS por finances.read; el resumen exige analytics.read
-- y products.read_cost. Se leen con una función que aplica la misma regla de
-- costo del resto de S1 (can_read_product_cost), no con la RLS de finanzas.
--
-- Como 01, parchea la definición vigente y aborta si no coincide.

begin;

create or replace function public.pos_sale_item_unit_costs(p_organization_id uuid, p_sale_ids uuid[])
returns table(sale_item_id uuid, unit_cost numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select snapshot.sale_item_id, snapshot.unit_cost
  from public.sale_item_cost_snapshots snapshot
  where snapshot.organization_id = p_organization_id
    and snapshot.sale_id = any(coalesce(p_sale_ids, '{}'::uuid[]))
    and public.can_read_product_cost(p_organization_id)
    and public.has_org_permission(p_organization_id, 'analytics.read');
$$;

revoke all on function public.pos_sale_item_unit_costs(uuid, uuid[]) from public, anon;
grant execute on function public.pos_sale_item_unit_costs(uuid, uuid[]) to authenticated, service_role;

-- Reemplaza un bloque de una definición de función comparando el código y no
-- los espacios: producción puede tener espacios al final de línea o \r\n que
-- el repo no tiene. Si el bloque no está, aborta con el código indicado.
create or replace function pg_temp.pos_stage_replace(source text, old_block text, new_block text, tag text)
returns text language plpgsql as $helper$
declare
  pattern text;
  matched text;
begin
  -- Sin los bordes: un \s+ inicial se tragaría el salto de línea anterior.
  pattern := regexp_replace(btrim(old_block, E' \t\r\n'), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
  pattern := regexp_replace(pattern, '\s+', '\\s+', 'g');
  matched := substring(source from pattern);
  if matched is null then raise exception '%', tag; end if;
  return replace(source, matched, btrim(new_block, E' \t\r\n'));
end $helper$;

do $migration$
declare
  source text;
  old_block text;
  new_block text;
begin
  select pg_get_functiondef(p.oid) into source
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'dashboard_pos_summary_s1';
  -- Las funciones creadas desde archivos de Windows guardan CRLF: se compara
  -- y se reinstala con LF, que para PL/pgSQL es equivalente.
  source := replace(source, E'\r\n', E'\n');
  if source is null then raise exception 'DASHBOARD_POS_SUMMARY_S1_MISSING'; end if;
  if position('pos_sale_item_unit_costs' in source) > 0 then
    raise notice 'dashboard_pos_summary_s1 ya usa el costo histórico: no se modifica.';
    return;
  end if;

  old_block := $old$    ), items as materialized (
      select i.quantity, i.subtotal, p.name, pc.purchase_price
      from public.sale_items i join period_sales s on s.id = i.sale_id
      left join public.products p on p.id = i.product_id and p.organization_id = p_organization_id
      left join product_costs pc on pc.product_id = p.id$old$;
  new_block := $new$    ), snapshot_costs as materialized (
      select sc.sale_item_id, sc.unit_cost
      from public.pos_sale_item_unit_costs(p_organization_id, (select array_agg(ps.id) from period_sales ps)) sc
      where v_cost_visible
    ), items as materialized (
      select i.quantity, i.subtotal, p.name, coalesce(snap.unit_cost, pc.purchase_price) purchase_price
      from public.sale_items i join period_sales s on s.id = i.sale_id
      left join public.products p on p.id = i.product_id and p.organization_id = p_organization_id
      left join product_costs pc on pc.product_id = p.id
      left join snapshot_costs snap on snap.sale_item_id = i.id$new$;
  source := pg_temp.pos_stage_replace(source, old_block, new_block, 'DASHBOARD_POS_SUMMARY_CONTRACT_CHANGED|items');

  old_block := 'coalesce(sum(coalesce(s.subtotal_amount,s.total_amount)),0) net,';
  new_block := 'coalesce(sum(s.total_amount - coalesce(s.tax_amount,0)),0) net,';
  source := pg_temp.pos_stage_replace(source, old_block, new_block, 'DASHBOARD_POS_SUMMARY_CONTRACT_CHANGED|net');

  execute source;
end $migration$;

do $$ begin raise notice 'PRUEBA EN SECO OK: %, se deshace con rollback.', '03_dashboard_net_and_historical_cost'; end $$;

rollback;
