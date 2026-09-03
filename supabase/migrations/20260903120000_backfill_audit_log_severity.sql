-- Completa la gravedad de los eventos de auditoria ya guardados.
--
-- `audit_log.severity` la escribia un unico lugar del proyecto: el registro de
-- superadmin. Todo lo que genera la aplicacion la dejaba en null, asi que la
-- pantalla /admin/security la deducia del nombre de la accion para mostrarla
-- pero filtraba consultando la columna: filtrar por "alta" o "critica" devolvia
-- siempre cero, justo para los eventos que se buscan.
--
-- El filtro ya se corrigio en la API —busca por columna y, cuando esta en null,
-- por accion— asi que la pantalla funciona con o sin este backfill. Esto es para
-- que la columna diga la verdad: hay un indice sobre
-- (organization_id, severity, created_at) que hoy no sirve de nada, y cualquier
-- consulta hecha por fuera de la aplicacion ve el campo vacio.
--
-- El mapa de abajo es el mismo de src/lib/security/audit-events.ts. La prueba
-- audit-severity-map.test.ts compara los dos y falla si se separan.

begin;

update public.audit_log
set severity = case action
  when 'grant_admin_self_rpc'               then 'critical'
  when 'unauthorized_admin_access_attempt'  then 'high'
  when 'role_change'                        then 'high'
  when 'grant_admin_migration'              then 'high'
  when 'suspicious_activity'                then 'high'
  when 'update_user_status'                 then 'high'
  when 'assign_role_by_email'               then 'high'
  when 'delete'                             then 'medium'
  when 'login_failed'                       then 'medium'
  when 'permission_denied'                  then 'medium'
  when 'data_export'                        then 'medium'
  when 'bulk_operation'                     then 'medium'
  when 'update_organization_settings'       then 'medium'
  when 'admin_api_access'                   then 'low'
  when 'create'                             then 'low'
  when 'update'                             then 'low'
  when 'login'                              then 'low'
  when 'logout'                             then 'low'
  when 'password_change'                    then 'low'
  else null
end
where severity is null
  -- Una accion que no esta en el catalogo se deja en null a proposito: inventarle
  -- "baja" seria afirmar algo que nadie decidio, y el filtro por accion tampoco
  -- la va a encontrar, con lo cual quedaria escondida bajo una etiqueta falsa.
  and action in (
    'grant_admin_self_rpc', 'unauthorized_admin_access_attempt', 'role_change',
    'grant_admin_migration', 'suspicious_activity', 'update_user_status',
    'assign_role_by_email', 'delete', 'login_failed', 'permission_denied',
    'data_export', 'bulk_operation', 'update_organization_settings',
    'admin_api_access', 'create', 'update', 'login', 'logout', 'password_change'
  );

commit;
