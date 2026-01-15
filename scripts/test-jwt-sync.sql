-- =====================================================
-- Script de Prueba: Verificar Sincronización JWT
-- =====================================================
-- Ejecutar DESPUÉS de aplicar las migraciones
-- =====================================================

\echo '=== 1. Verificar que las funciones existen y usan JWT ==='

SELECT 
  proname as function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%current_setting%jwt%' THEN '✅ Usa JWT'
    WHEN pg_get_functiondef(oid) LIKE '%FROM profiles%' THEN '❌ Consulta profiles (RECURSIÓN)'
    ELSE '⚠️ Revisar manualmente'
  END as status
FROM pg_proc
WHERE proname IN ('get_jwt_role', 'is_admin', 'is_staff', 'get_user_role')
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

\echo ''
\echo '=== 2. Verificar sincronización de roles existentes ==='

SELECT 
  u.id,
  u.email,
  u.raw_app_meta_data->>'role' as jwt_role,
  p.role as profile_role,
  CASE 
    WHEN u.raw_app_meta_data->>'role' = p.role THEN '✅ Sincronizado'
    WHEN u.raw_app_meta_data->>'role' IS NULL THEN '⚠️ JWT sin rol (hacer logout/login)'
    ELSE '❌ Desincronizado'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.role IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 10;

\echo ''
\echo '=== 3. Verificar políticas RLS en profiles ==='

SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%profiles%' THEN '❌ POSIBLE RECURSIÓN'
    WHEN qual::text LIKE '%is_admin%' OR qual::text LIKE '%is_staff%' THEN '✅ Usa funciones JWT'
    WHEN qual::text LIKE '%auth.uid()%' THEN '✅ Usa auth.uid()'
    ELSE '⚠️ Revisar'
  END as status,
  LEFT(qual::text, 80) as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname;

\echo ''
\echo '=== 4. Verificar que el trigger existe ==='

SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ Activo'
    WHEN tgenabled = 'D' THEN '❌ Deshabilitado'
    ELSE '⚠️ Estado: ' || tgenabled
  END as status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'sync_role_to_jwt_trigger';

\echo ''
\echo '=== 5. Probar función get_jwt_role() ==='

-- Esto mostrará el rol del usuario actual desde JWT
SELECT 
  auth.uid() as current_user_id,
  public.get_jwt_role() as jwt_role,
  public.is_admin() as is_admin,
  public.is_staff() as is_staff;

\echo ''
\echo '=== 6. Contar usuarios por estado de sincronización ==='

SELECT 
  COUNT(*) FILTER (WHERE u.raw_app_meta_data->>'role' = p.role) as sincronizados,
  COUNT(*) FILTER (WHERE u.raw_app_meta_data->>'role' IS NULL) as sin_jwt,
  COUNT(*) FILTER (WHERE u.raw_app_meta_data->>'role' != p.role AND u.raw_app_meta_data->>'role' IS NOT NULL) as desincronizados,
  COUNT(*) as total
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.role IS NOT NULL;

\echo ''
\echo '=== RESUMEN ==='
\echo 'Si ves:'
\echo '  ✅ Funciones usan JWT'
\echo '  ✅ Políticas sin recursión'
\echo '  ✅ Trigger activo'
\echo ''
\echo 'Entonces la corrección está aplicada correctamente.'
\echo ''
\echo 'Si hay usuarios "sin_jwt", deben hacer logout/login para obtener nuevo JWT.'
