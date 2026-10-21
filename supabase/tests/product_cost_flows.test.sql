-- S1: flujos de negocio con 01, 02 y 03 aplicadas (ventas, anulación, tomas de inventario,
-- tipo de cambio, guardado de productos, resúmenes). Comprueba que la protección de costos
-- no rompe lo que ya funcionaba. Solo en una base local o una rama, nunca en producción.
begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000005a1', 's1f-owner@test.local'),
  ('00000000-0000-4000-8000-0000000005a2', 's1f-tech@test.local'),
  ('00000000-0000-4000-8000-0000000005a3', 's1f-multi@test.local');
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-00000000050a', 'S1F Comercio A', 's1f-a'),
  ('00000000-0000-4000-8000-00000000050b', 'S1F Comercio B', 's1f-b');
insert into public.organization_members (organization_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005a2', 'technician', 'active'),
  -- Usuario en dos organizaciones: dueño en B, técnico en A.
  ('00000000-0000-4000-8000-00000000050b', '00000000-0000-4000-8000-0000000005a3', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005a3', 'technician', 'active');
insert into public.branches (id, organization_id, code, name, slug, is_active) values
  ('00000000-0000-4000-8000-0000000005b9', '00000000-0000-4000-8000-00000000050a', 'S1F', 'S1F Sucursal', 's1f-suc', true);
insert into public.exchange_rates (organization_id, currency, rate, rounding) values
  ('00000000-0000-4000-8000-00000000050a', 'USD', 7000, 1);
insert into public.products (id, organization_id, sku, name, sale_price, purchase_price, stock_quantity, min_stock) values
  ('00000000-0000-4000-8000-0000000005f1', '00000000-0000-4000-8000-00000000050a', 'S1F-1', 'Producto flujo', 200, 100, 10, 1),
  ('00000000-0000-4000-8000-0000000005f9', '00000000-0000-4000-8000-00000000050b', 'S1F-B', 'Producto de B', 80, 30, 3, 1);
insert into public.products (id, organization_id, sku, name, sale_price, price_currency, foreign_sale_price, foreign_purchase_price, stock_quantity) values
  ('00000000-0000-4000-8000-0000000005f5', '00000000-0000-4000-8000-00000000050a', 'S1F-USD', 'Producto en dólares', 0, 'USD', 10, 6, 1);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'service_role', true);
end $$;
grant execute on function pg_temp.as_service() to authenticated, service_role;
create function pg_temp.cost_of(p_id uuid) returns numeric language sql security definer as $$
  select purchase_price from public.products where id = p_id;
$$;
grant execute on function pg_temp.cost_of(uuid) to authenticated, service_role;

-- ─── Venta y anulación (las hace la API con el rol de servicio) ─────────────
select pg_temp.as_service();
select lives_ok($$ insert into public.sales (id, organization_id, branch_id, code, total_amount, subtotal_amount, payment_method, status)
  values ('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005b9', 'S1F-V', 400, 400, 'cash', 'completed') $$,
  'servicio: registra la venta');
select lives_ok($$ insert into public.sale_items (sale_id, organization_id, product_id, quantity, unit_price, subtotal)
  values ('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005f1', 2, 200, 400) $$,
  'servicio: registra el ítem vendido');
select is((select unit_cost from public.sale_item_cost_snapshots where sale_item_id = (select id from public.sale_items where sale_id = '00000000-0000-4000-8000-0000000005d1')),
  100::numeric, 'la copia del costo de la venta se guarda con el costo real');
select lives_ok($$ select public.void_pos_sale('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005a1', 'prueba S1') $$,
  'servicio: anula la venta');
select is((select status from public.sales where id = '00000000-0000-4000-8000-0000000005d1'), 'cancelled', 'la venta quedó anulada');

-- ─── Guardado de producto con variantes (definer, upsert) ───────────────────
select lives_ok($$ select public.save_product_with_variants(
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000005f1', 'organization_id', '00000000-0000-4000-8000-00000000050a',
      'name', 'Producto flujo', 'sku', 'S1F-1', 'sale_price', 210, 'purchase_price', 100, 'has_variants', false,
      'warranty_months', 0, 'return_window_days', 0, 'exchange_window_days', 0, 'stock_quantity', 10, 'min_stock', 1),
    '[]'::jsonb, null, '00000000-0000-4000-8000-0000000005a1') $$,
  'servicio: save_product_with_variants guarda');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000005f1'), 100::numeric, 'el costo no se perdió');

-- ─── Tipo de cambio (dueño) ─────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000005a1');
select lives_ok($$ select public.set_exchange_rate('00000000-0000-4000-8000-00000000050a', 'USD', 7500, 1) $$,
  'dueño: cambia el tipo de cambio');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000005f5'), 45000::numeric, 'el costo local del producto en dólares se recalcula (6 × 7500)');

-- ─── Toma de inventario (dueño, definer) ────────────────────────────────────
select lives_ok($$ insert into public.inventory_counts (id, organization_id, branch_id, number, name, status, created_by)
  values ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005b9', 9001, 'Toma S1', 'counting', '00000000-0000-4000-8000-0000000005a1') $$,
  'dueño: abre una toma');
reset role;
insert into public.inventory_count_items (count_id, organization_id, product_id, name, unit_cost, system_qty, counted_qty)
  values ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-0000000005f1', 'Producto flujo', 100, 10, 8);
select pg_temp.act_as('00000000-0000-4000-8000-0000000005a1');
select lives_ok($$ select public.apply_inventory_count('00000000-0000-4000-8000-0000000005c1') $$,
  'dueño: aplica la toma con la 03 vigente');

-- ─── Resúmenes que lee el navegador ─────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000005a2');
select lives_ok($$ select public.get_recent_movements() $$, 'técnico: movimientos recientes funcionan');
select lives_ok($$ select public.get_top_selling_products() $$, 'técnico: más vendidos funciona');
select pg_temp.act_as('00000000-0000-4000-8000-0000000005a1');
select lives_ok($$ select public.dashboard_home_summary('00000000-0000-4000-8000-00000000050a') $$, 'dueño: resumen de inicio funciona');

-- ─── Usuario en dos organizaciones ──────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000005a3');
select ok((select count(*) = 1 and bool_and(organization_id = '00000000-0000-4000-8000-00000000050b') from public.get_product_costs(array['00000000-0000-4000-8000-0000000005f1','00000000-0000-4000-8000-0000000005f9']::uuid[], '00000000-0000-4000-8000-00000000050b')),
  'dueño en B y técnico en A: solo ve los costos de B');
select ok((select total_cost_value is null from public.product_stats),
  'el agregado que mezcla A y B no informa costo (no puede ver todos)');

select * from finish();
rollback;
