-- Pruebas de módulos: solo las crea el servidor.
--
-- La política "owners admins create module trials" dejaba que el dueño o un
-- admin insertara filas directo desde el navegador (con la clave pública de
-- Supabase) sin ninguna validación de la fecha: una prueba que vence en 2099
-- de cualquier módulo era un módulo pago gratis para siempre. La API
-- (/api/admin/module-trials) ya inserta con service_role y valida el módulo,
-- que no se haya usado y los 7 días.
--
-- Además, la base exige ahora que una prueba dure como mucho 8 días y sea de
-- un módulo que se puede probar. Las filas existentes que se pasaban del plazo
-- se recortan a 7 días desde su inicio.

drop policy if exists "owners admins create module trials" on public.organization_module_trials;
revoke insert, update, delete on public.organization_module_trials from anon, authenticated;

update public.organization_module_trials
   set expires_at = started_at + interval '7 days'
 where expires_at > started_at + interval '8 days';

alter table public.organization_module_trials
  add constraint organization_module_trials_max_length
  check (expires_at <= started_at + interval '8 days');

alter table public.organization_module_trials
  add constraint organization_module_trials_module_allowed
  check (module in (
    'inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'delivery',
    'analytics', 'web_analytics', 'promotions', 'security', 'credits', 'finances', 'reports'
  )) not valid;
