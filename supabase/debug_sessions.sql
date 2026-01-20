-- Script de Diagnóstico para Sesiones de Usuario
-- Ejecuta estos queries en Supabase SQL Editor para diagnosticar el problema

-- 1. Verificar si la tabla user_sessions existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_sessions'
) AS table_exists;

-- 2. Ver todas las sesiones en la tabla
SELECT 
  id,
  user_id,
  session_id,
  device_type,
  browser,
  os,
  country,
  city,
  is_active,
  last_activity,
  created_at
FROM user_sessions
ORDER BY created_at DESC
LIMIT 20;

-- 3. Contar sesiones por usuario
SELECT 
  user_id,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN is_active THEN 1 END) as active_sessions
FROM user_sessions
GROUP BY user_id;

-- 4. Verificar que la función RPC existe
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'get_user_active_sessions';

-- 5. Probar la función RPC manualmente (reemplaza 'YOUR-USER-ID' con tu UUID)
-- SELECT * FROM get_user_active_sessions('YOUR-USER-ID');

-- 6. Verificar políticas RLS en la tabla
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
WHERE tablename = 'user_sessions';

-- 7. Verificar que RLS está habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'user_sessions';

-- 8. Intentar insertar una sesión de prueba (reemplaza con tus datos)
/*
INSERT INTO user_sessions (
  user_id,
  session_id,
  user_agent,
  device_type,
  browser,
  os,
  is_active
) VALUES (
  auth.uid(), -- Usa tu usuario actual
  'test-session-' || gen_random_uuid()::text,
  'Test User Agent',
  'desktop',
  'Chrome',
  'Windows',
  true
);
*/

-- 9. Ver logs de errores recientes (si tienes acceso)
-- SELECT * FROM pgaudit_log ORDER BY created_at DESC LIMIT 10;
