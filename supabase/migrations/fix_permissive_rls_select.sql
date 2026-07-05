-- =====================================================
-- FIX: políticas RLS SELECT permisivas (USING true) que permitían
-- lectura cross-tenant a cualquier usuario 'authenticated' vía la anon key.
-- =====================================================
-- Contexto: la app usa service-role + scoping por organization_id, pero estas
-- políticas dejaban leer TODAS las filas de TODOS los tenants a cualquier
-- usuario logueado que consulte Supabase directo desde el navegador.
--
-- Reemplazan `USING (true)` por scope de tenant reusando los helpers ya
-- presentes en el resto de las políticas (organization_members,
-- get_current_user_org_id, get_jwt_role, has_permission).
--
-- Antes de aplicar en prod: validar en dev. Para confirmar nombres de columna:
--   select table_name, column_name from information_schema.columns
--   where table_schema='public'
--     and table_name in ('repair_status_history','variant_attributes','variant_attribute_options')
--     and column_name in ('organization_id','repair_id','attribute_id')
--   order by table_name, column_name;

begin;

-- ---------------------------------------------------------------
-- 1) user_roles  [ALTA] — exponía el mapeo usuario→rol de TODA la plataforma
-- ---------------------------------------------------------------
drop policy if exists "Admins can view all user roles" on public.user_roles;
drop policy if exists "user_roles_select_scoped" on public.user_roles;
create policy "user_roles_select_scoped" on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or get_jwt_role() = 'super_admin'
    or (
      has_permission('users.manage')
      and exists (
        select 1 from public.organization_members om
        where om.user_id = user_roles.user_id
          and om.organization_id = get_current_user_org_id()
      )
    )
  );

-- ---------------------------------------------------------------
-- 2) cash_movements  [MEDIA] — datos financieros cross-tenant
-- ---------------------------------------------------------------
drop policy if exists "solo usuarios autenticados pueden leer" on public.cash_movements;
drop policy if exists "cash_movements_select_org" on public.cash_movements;
create policy "cash_movements_select_org" on public.cash_movements
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = (select auth.uid())
        and om.organization_id = cash_movements.organization_id
        and om.status = 'active'
    )
  );

-- ---------------------------------------------------------------
-- 3) product_alerts  [BAJA-MEDIA] — alertas de stock cross-tenant
--    Confirmado: NO tiene organization_id; se scopea vía product_id -> products.
-- ---------------------------------------------------------------
drop policy if exists "autenticados pueden leer alertas" on public.product_alerts;
drop policy if exists "product_alerts_select_org" on public.product_alerts;
create policy "product_alerts_select_org" on public.product_alerts
  for select to authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.organization_members om on om.organization_id = p.organization_id
      where p.id = product_alerts.product_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

-- ---------------------------------------------------------------
-- 4) repair_status_history  [MEDIA]
--    Confirmado: no tiene organization_id; se scopea vía repair_id -> repairs.
-- ---------------------------------------------------------------
drop policy if exists "repair_status_history_select_unified" on public.repair_status_history;
drop policy if exists "repair_status_history_select_org" on public.repair_status_history;
create policy "repair_status_history_select_org" on public.repair_status_history
  for select to authenticated
  using (
    exists (
      select 1
      from public.repairs r
      join public.organization_members om on om.organization_id = r.organization_id
      where r.id = repair_status_history.repair_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

-- ---------------------------------------------------------------
-- variant_attributes / variant_attribute_options  [BAJA] — OMITIDAS
--    Confirmado que variant_attributes NO tiene organization_id (el esquema
--    usa organization_id en todo el resto), por lo que se consideran catálogo
--    GLOBAL: la lectura por cualquier usuario autenticado es aceptable y no
--    expone datos de otro tenant. No se modifican.
-- ---------------------------------------------------------------

commit;
