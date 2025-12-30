-- Script completo para configurar el sistema de logs de seguridad
-- Ejecutar este script en Supabase SQL Editor

-- 1. Crear las funciones de logging si no existen
\i supabase/migrations/create_security_logging_functions.sql

-- 2. Insertar datos de ejemplo
\i supabase/migrations/insert_sample_security_logs.sql

-- 3. Verificar que todo esté funcionando
SELECT 
    'Logs de auditoría' as tabla,
    COUNT(*) as registros
FROM public.audit_log
UNION ALL
SELECT 
    'Usuarios' as tabla,
    COUNT(*) as registros
FROM auth.users;

-- 4. Mostrar algunos logs de ejemplo
SELECT 
    al.action,
    al.resource,
    p.email as user_email,
    al.ip_address,
    al.created_at,
    al.new_values->>'severity' as severity
FROM public.audit_log al
LEFT JOIN profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 10;

-- 5. Probar la función de estadísticas
SELECT public.get_security_stats(24) as stats_24h;