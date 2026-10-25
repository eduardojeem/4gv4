-- HISTORICAL FILENAME: rollback_03.sql is NOT a rollback of migration 03.
-- RESTRICTIVE RECOVERY: reasserts post-03 ACL; deliberately does NOT restore
-- direct SELECT on cost columns for anon/authenticated, nor table
-- SELECT/TRUNCATE/TRIGGER/REFERENCES. It does NOT return the database to the
-- insecure pre-03 state. No functions are removed, and 01/04 are unchanged.
-- Never run automatically. Human authorization and incident-specific review
-- are required; choose any actual rollback/recovery only after evaluating the
-- concrete failure and verified database state.
-- BORRADOR PARA REVISIÓN — NO EJECUTAR EN PRODUCCIÓN.
-- S1, Etapa 2b: retirar la lectura directa de las columnas de costo.
-- Aplicar SOLO cuando 01 y 02 estén en producción y la web desplegada ya no lea
-- costos ni use select('*') sobre estas tablas (ver el doc, sección de despliegue).
-- Recovery is not an automatic or immediate reversal. The separately named
-- rollback_03.sql file is restrictive and does not reopen direct cost access.
--
-- En PostgreSQL un REVOKE de columna no tiene efecto mientras exista el SELECT
-- sobre la tabla entera: por eso se retira el SELECT de la tabla y se concede
-- columna por columna todo menos el costo. Una columna nueva queda invisible
-- para anon/authenticated hasta agregarla acá (lo vigila la prueba pgTAP
-- product_cost_column_privileges).
--
-- INSERT/UPDATE/DELETE siguen a nivel de tabla: la RLS decide las filas y el
-- trigger de 01 decide quién cambia el costo. Sin SELECT sobre el costo, un
-- UPDATE ... RETURNING purchase_price o un WHERE purchase_price > x también
-- fallan (Postgres exige SELECT sobre las columnas que se leen).

begin;

revoke select on table public.products from anon, authenticated;
grant select (
  id, sku, name, description, category_id, brand, supplier_id,
  sale_price, wholesale_price, offer_price, has_offer, stock_quantity, min_stock, max_stock,
  unit_measure, barcode, images, image_url, weight, dimensions, location, tags, is_active, featured,
  created_at, updated_at, brand_id, visibility, warranty_months, warranty_info, return_window_days,
  exchange_window_days, return_policy, exchange_policy, stock_status_computed, organization_id,
  installments_enabled, installments_plans, installments_public, deactivated_by_plan, archived_by_plan_at,
  tax_rate, has_variants, variant_attribute_config, device_brand, device_models, device_sort_key,
  hide_price, price_currency, foreign_sale_price, foreign_wholesale_price, search_text, public_price
) on table public.products to anon, authenticated;

revoke select on table public.product_variants from anon, authenticated;
grant select (
  id, product_id, variant_name, sku, price_adjustment, stock_quantity, is_active, created_at, updated_at,
  organization_id, attributes, barcode, sale_price, wholesale_price, min_stock
) on table public.product_variants to anon, authenticated;

-- Privilegios que ningún cliente usa y que no pasan por la RLS (TRUNCATE) o
-- permiten crear objetos sobre la tabla.
revoke truncate, trigger, references on table public.products, public.product_variants from anon, authenticated;

-- Close the legacy numeric entry point only AFTER the compatible web is deployed.
-- 02 deliberately preserves it during the 02 -> web transition.
create or replace function public.dashboard_pos_summary(p_organization_id uuid, p_branch_id uuid,
  p_from timestamptz, p_to timestamptz, p_timezone text default 'America/Asuncion')
returns jsonb language sql stable security invoker set search_path = '' as $compat$
  select public.dashboard_pos_summary_s1(p_organization_id,p_branch_id,p_from,p_to,p_timezone);
$compat$;
revoke all on function public.dashboard_pos_summary(uuid,uuid,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.dashboard_pos_summary(uuid,uuid,timestamptz,timestamptz,text) to authenticated, service_role;
commit;

