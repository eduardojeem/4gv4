begin;

-- Los reportes del navegador pasan por /api/system/log-error. Ese endpoint
-- aplica rate limit, valida tamaños y deriva user_id/organization_id en el
-- servidor antes de insertar con service_role. Los clientes no escriben aquí.
drop policy if exists "system_error_logs_insert_policy" on public.system_error_logs;

revoke insert on public.system_error_logs from anon, authenticated;
grant insert on public.system_error_logs to service_role;

commit;
