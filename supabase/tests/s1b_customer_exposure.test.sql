-- S1b: lo que el rol `customer` y el personal sin permiso de costos pueden leer por la
-- Data API. Expectativas SEGURAS: sin 04 fallan (vulnerabilidad), con 04 pasan.
-- Requiere las políticas de producción de estas tablas (ver el doc, S1b) y 01.
-- Solo base local aislada o rama; nunca producción. Todo con rollback.
begin;
select plan(30);

-- ─── Datos sintéticos (como postgres, sin triggers ni FK para sembrar rápido) ──
set local session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000006a1', 's1b-owner@test.local'),
  ('00000000-0000-4000-8000-0000000006a2', 's1b-tech@test.local'),
  ('00000000-0000-4000-8000-0000000006a3', 's1b-tech-cost@test.local'),
  ('00000000-0000-4000-8000-0000000006c1', 's1b-cliente@test.local'),
  ('00000000-0000-4000-8000-0000000006b1', 's1b-admin-b@test.local');
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-00000000060a', 'S1B A', 's1b-a'), ('00000000-0000-4000-8000-00000000060b', 'S1B B', 's1b-b');
insert into public.branches (id, organization_id, code, name, slug, is_active) values
  ('00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-00000000060a', 'S1B', 'Suc A', 's1b-suc', true);
insert into public.organization_members (organization_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006a2', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006a3', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006c1', 'customer', 'active'),
  ('00000000-0000-4000-8000-00000000060b', '00000000-0000-4000-8000-0000000006b1', 'admin', 'active');
insert into public.user_branch_assignments (user_id, branch_id, organization_id, is_active, is_primary) values
  ('00000000-0000-4000-8000-0000000006a2', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-00000000060a', true, true),
  ('00000000-0000-4000-8000-0000000006a3', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-00000000060a', true, true);
insert into public.user_permissions (user_id, organization_id, permission, is_active) values
  ('00000000-0000-4000-8000-0000000006a3', '00000000-0000-4000-8000-00000000060a', 'products.read_cost', true);
-- Dos clientes: el propio (vinculado al usuario cliente) y otra persona.
insert into public.customers (id, organization_id, name, phone, email, profile_id, status) values
  ('00000000-0000-4000-8000-0000000006d1', '00000000-0000-4000-8000-00000000060a', 'Cliente propio', '0981000001', 'propio@test.local', '00000000-0000-4000-8000-0000000006c1', 'activo'),
  ('00000000-0000-4000-8000-0000000006d2', '00000000-0000-4000-8000-00000000060a', 'Otra persona', '0981000002', 'otra@test.local', null, 'activo');
insert into public.repairs (id, organization_id, branch_id, customer_id, device_brand, device_model, problem_description) values
  ('00000000-0000-4000-8000-0000000006e2', '00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-0000000006d2', 'Marca', 'Modelo', 'Pantalla');
insert into public.repair_payments (repair_id, organization_id, branch_id, amount, payment_method, idempotency_key, source) values
  ('00000000-0000-4000-8000-0000000006e2', '00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006b9', 150000, 'cash', 's1b-pay-000001', 'repairs');
insert into public.repair_closeouts (organization_id, branch_id, repair_id, outcome, charge_mode, final_charge, paid_before, settlement_kind, idempotency_key) values
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-0000000006e2', 'withdrawn', 'none', 150000, 0, 'none', 's1b-close-000001');
insert into public.repair_quality_checks (organization_id, branch_id, repair_id, result) values
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-0000000006e2', 'passed');
insert into public.repair_cost_revisions (id, organization_id, branch_id, repair_id, revision_number, actor_role, labor_amount, labor_tax_rate, parts_subtotal, parts_internal_cost,
    additional_charges, deductions, discount_amount, subtotal_before_discount, final_total, paid_amount_snapshot, balance_snapshot, intent_hash, idempotency_key) values
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-0000000006e2', 1, 'owner',
    50000, 10, 100000, 60000, 0, 0, 0, 150000, 150000, 0, 150000, 'h', 's1b-rev');
insert into public.repair_cost_revision_parts (revision_id, organization_id, branch_id, repair_id, part_name, quantity, unit_cost_snapshot, unit_price_snapshot, discount_amount, tax_rate, subtotal) values
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006b9', '00000000-0000-4000-8000-0000000006e2', 'Pantalla', 1, 60000, 100000, 0, 10, 100000);
insert into public.repair_status_history (repair_id, organization_id, new_status) values
  ('00000000-0000-4000-8000-0000000006e2', '00000000-0000-4000-8000-00000000060a', 'recibido');
insert into public.repair_images (repair_id, image_url) values
  ('00000000-0000-4000-8000-0000000006e2', 'organizations/00000000-0000-4000-8000-00000000060a/repair-images/00000000-0000-4000-8000-0000000006a2/s1b.jpg');
insert into public.customer_orders (id, organization_id, order_number, customer_name, customer_id, status, payment_status, payment_method, fulfillment_type) values
  ('00000000-0000-4000-8000-0000000006a9', '00000000-0000-4000-8000-00000000060a', 'S1B-1', 'Otra persona', '00000000-0000-4000-8000-0000000006d2', 'PENDIENTE', 'PENDIENTE', 'EFECTIVO', 'RETIRO');
insert into public.customer_order_items (id, organization_id, order_id, product_name, quantity) values
  ('00000000-0000-4000-8000-0000000006aa', '00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006a9', 'Producto', 1);
insert into public.customer_order_item_cost_snapshots (organization_id, order_id, order_item_id, quantity, unit_cost, total_cost) values
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-0000000006a9', '00000000-0000-4000-8000-0000000006aa', 1, 7000, 7000);
set local session_replication_role = origin;

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

-- ─── Usuario con rol customer ───────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000006c1');
select ok(not public.has_org_permission('00000000-0000-4000-8000-00000000060a', 'repairs.orders.read'), 'customer: sin repairs.orders.read');
select is((select count(*)::int from public.customers where id = '00000000-0000-4000-8000-0000000006d2'), 0, 'customer: no lee los datos de otro cliente');
select is((select count(*)::int from public.customers), 0, 'customer: no lista la cartera de clientes');
select is((select count(*)::int from public.repair_payments), 0, 'customer: no lee pagos de reparaciones');
select is((select count(*)::int from public.repair_closeouts), 0, 'customer: no lee cierres de reparaciones');
select is((select count(*)::int from public.repair_quality_checks), 0, 'customer: no lee controles de calidad');
select is((select count(*)::int from public.repair_cost_revisions), 0, 'customer: no lee revisiones de costo');
select is((select count(*)::int from public.repair_cost_revision_parts), 0, 'customer: no lee el costo interno de repuestos');
select is((select count(*)::int from public.customer_order_item_cost_snapshots), 0, 'customer: no lee el costo de los pedidos');
select is((select count(*)::int from public.repair_status_history), 0, 'customer: no lee el historial de reparaciones ajenas');
select is((select count(*)::int from public.repair_images), 0, 'customer: no lee fotos de reparaciones ajenas');
select is((select count(*)::int from public.repairs), 0, 'customer: no lee reparaciones (ya lo impedía la política por sucursal)');
select is((select count(*)::int from public.customer_orders where id = '00000000-0000-4000-8000-0000000006a9'), 0, 'customer: no lee pedidos de otros');

-- ─── Técnico con sucursal, sin permiso de costos (no tiene que perder nada) ──
select pg_temp.act_as('00000000-0000-4000-8000-0000000006a2');
select is((select count(*)::int from public.customers), 2, 'técnico: sigue leyendo clientes');
select is((select count(*)::int from public.repair_payments), 1, 'técnico: sigue leyendo pagos');
select is((select count(*)::int from public.repair_closeouts), 1, 'técnico: sigue leyendo cierres');
select is((select count(*)::int from public.repair_quality_checks), 1, 'técnico: sigue leyendo controles de calidad');
select is((select count(*)::int from public.repair_status_history), 1, 'técnico: sigue leyendo el historial');
select is((select count(*)::int from public.repair_images), 0, 'técnico: fotos privadas se leen mediante la API autorizada');
select is((select count(*)::int from public.repair_cost_revisions), 0, 'técnico sin read_cost: no lee revisiones de costo');
select is((select count(*)::int from public.repair_cost_revision_parts), 0, 'técnico sin read_cost: no lee el costo interno de repuestos');
select is((select count(*)::int from public.customer_order_item_cost_snapshots), 0, 'técnico sin read_cost: no lee el costo de pedidos');

-- ─── Técnico con products.read_cost ─────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000006a3');
select is((select parts_internal_cost from public.repair_cost_revisions), 60000::numeric, 'con read_cost: lee la revisión de costo');
select is((select unit_cost_snapshot from public.repair_cost_revision_parts), 60000::numeric, 'con read_cost: lee el costo del repuesto');
select is((select unit_cost from public.customer_order_item_cost_snapshots), 7000::numeric, 'con read_cost: lee el costo del pedido');

-- ─── Dueño ──────────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000006a1');
select ok((select count(*) = 1 from public.repair_cost_revisions) and (select count(*) = 1 from public.customer_order_item_cost_snapshots), 'dueño: lee costos internos');
select is((select count(*)::int from public.customers), 2, 'dueño: lee clientes');

-- ─── Administrador de otro comercio ─────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000006b1');
select is((select count(*)::int from public.customers where organization_id = '00000000-0000-4000-8000-00000000060a'), 0, 'admin de B: no lee clientes de A');
select is((select count(*)::int from public.repair_cost_revisions), 0, 'admin de B: no lee costos de A');

-- ─── anon ───────────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select count(*)::int from public.repair_cost_revisions), 0, 'anon: sin filas');

select * from finish();
rollback;

