-- Las funciones tenant de RLS get_org_role()/has_org_permission() se crearon
-- (20260601000000_saas_multitenant_foundation.sql) DESPUÉS del hardening
-- (20260509000000_harden_security_definer_rpc_access.sql), que dejó un
-- ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated.
-- Resultado: nacieron sin EXECUTE para `authenticated`, por lo que cualquier
-- lectura DIRECTA del cliente sobre una tabla cuya RLS las invoca falla con
-- 42501 "permission denied for function ...". Esto rompía fetchMessages() en
-- /dashboard/repairs/communications (communication_messages se lee por cliente).
--
-- Ambas son SECURITY DEFINER y se auto-limitan por auth.uid() (solo exponen el
-- rol/permiso del propio usuario), así que conceder EXECUTE es seguro y necesario
-- para que la RLS evaluada del lado cliente funcione.

GRANT EXECUTE ON FUNCTION public.get_org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, text) TO authenticated;
