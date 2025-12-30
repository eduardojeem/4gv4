-- Script para verificar la configuración de seguridad
-- Ejecutar en Supabase SQL Editor para diagnosticar problemas

-- 1. Verificar si la tabla audit_log existe
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename = 'audit_log';

-- 2. Verificar estructura de la tabla audit_log
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audit_log' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'audit_log';

-- 4. Verificar si hay datos en la tabla
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM public.audit_log;

-- 5. Verificar funciones RPC
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('get_security_stats', 'log_auth_event', 'log_data_event')
ORDER BY routine_name;

-- 6. Verificar rol del usuario actual
SELECT 
    auth.uid() as current_user_id,
    public.get_user_role() as current_role,
    public.has_permission('settings.read') as has_settings_read;

-- 7. Verificar tabla profiles
SELECT 
    COUNT(*) as profile_count,
    COUNT(*) FILTER (WHERE email IS NOT NULL) as profiles_with_email
FROM public.profiles;

-- 8. Mostrar algunos logs de ejemplo si existen
SELECT 
    al.id,
    al.action,
    al.resource,
    al.user_id,
    p.email as user_email,
    al.created_at,
    al.new_values->>'severity' as severity
FROM public.audit_log al
LEFT JOIN public.profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 5;