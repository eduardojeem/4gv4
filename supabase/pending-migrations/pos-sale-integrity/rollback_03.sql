-- Reversión de 03: vuelve al costo actual y a subtotal_amount como «sin IVA».

begin;

do $migration$
declare
  source text;
begin
  select pg_get_functiondef(p.oid) into source
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'dashboard_pos_summary_s1';
  -- Las funciones creadas desde archivos de Windows guardan CRLF: se compara
  -- y se reinstala con LF, que para PL/pgSQL es equivalente.
  source := replace(source, E'\r\n', E'\n');
  if position('pos_sale_item_unit_costs' in source) = 0 then
    raise notice 'dashboard_pos_summary_s1 no tiene los cambios de 03: no se modifica.';
    return;
  end if;
  source := replace(source, $new$    ), snapshot_costs as materialized (
      select sc.sale_item_id, sc.unit_cost
      from public.pos_sale_item_unit_costs(p_organization_id, (select array_agg(ps.id) from period_sales ps)) sc
      where v_cost_visible
    ), items as materialized (
      select i.quantity, i.subtotal, p.name, coalesce(snap.unit_cost, pc.purchase_price) purchase_price
      from public.sale_items i join period_sales s on s.id = i.sale_id
      left join public.products p on p.id = i.product_id and p.organization_id = p_organization_id
      left join product_costs pc on pc.product_id = p.id
      left join snapshot_costs snap on snap.sale_item_id = i.id$new$, $old$    ), items as materialized (
      select i.quantity, i.subtotal, p.name, pc.purchase_price
      from public.sale_items i join period_sales s on s.id = i.sale_id
      left join public.products p on p.id = i.product_id and p.organization_id = p_organization_id
      left join product_costs pc on pc.product_id = p.id$old$);
  source := replace(source, 'coalesce(sum(s.total_amount - coalesce(s.tax_amount,0)),0) net,', 'coalesce(sum(coalesce(s.subtotal_amount,s.total_amount)),0) net,');
  if position('pos_sale_item_unit_costs' in source) > 0 then raise exception 'DASHBOARD_ROLLBACK_CONTRACT_CHANGED'; end if;
  execute source;
end $migration$;

drop function if exists public.pos_sale_item_unit_costs(uuid, uuid[]);

commit;
