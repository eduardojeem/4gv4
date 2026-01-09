-- =====================================================
-- SCRIPT: Verificar Permisos de Categorías (Supabase Compatible)
-- Date: 2025-01-07
-- Description: Script para verificar permisos RLS sin bloques DO
-- Compatible con Supabase SQL Editor
-- =====================================================

-- 1. Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS HABILITADO'
        ELSE '❌ RLS DESHABILITADO'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'categories';

-- 2. Listar todas las políticas activas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    CASE 
        WHEN cmd = 'SELECT' THEN '📖 Lectura'
        WHEN cmd = 'INSERT' THEN '➕ Inserción'
        WHEN cmd = 'UPDATE' THEN '✏️ Actualización'
        WHEN cmd = 'DELETE' THEN '🗑️ Eliminación'
        WHEN cmd = 'ALL' THEN '🔓 Todas las operaciones'
        ELSE cmd
    END as operation_desc
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'categories'
ORDER BY cmd, policyname;

-- 3. Verificar función helper
SELECT 
    proname as function_name,
    prorettype::regtype as return_type,
    prosecdef as security_definer,
    CASE 
        WHEN prosecdef THEN '✅ SECURITY DEFINER'
        ELSE '❌ NO SECURITY DEFINER'
    END as security_status
FROM pg_proc 
WHERE proname = 'user_has_category_write_permission';

-- 4. Contar categorías existentes
SELECT 
    COUNT(*) as total_categories,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Categorías encontradas'
        ELSE '❌ No hay categorías'
    END as status
FROM public.categories;

-- 5. Mostrar categorías existentes
SELECT 
    id,
    name,
    description,
    created_at
FROM public.categories
ORDER BY name;

-- 6. Verificar permisos de tabla
SELECT 
    grantee,
    privilege_type,
    is_grantable,
    CASE 
        WHEN privilege_type = 'SELECT' THEN '📖 Lectura'
        WHEN privilege_type = 'INSERT' THEN '➕ Inserción'
        WHEN privilege_type = 'UPDATE' THEN '✏️ Actualización'
        WHEN privilege_type = 'DELETE' THEN '🗑️ Eliminación'
        ELSE privilege_type
    END as privilege_desc
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'categories'
AND grantee = 'authenticated'
ORDER BY privilege_type;

-- 7. Resumen de estado
SELECT 
    'RESUMEN DE VERIFICACIÓN' as section,
    '' as detail
UNION ALL
SELECT 
    '=========================' as section,
    '' as detail
UNION ALL
SELECT 
    'RLS Estado:' as section,
    CASE 
        WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'categories') 
        THEN '✅ HABILITADO'
        ELSE '❌ DESHABILITADO'
    END as detail
UNION ALL
SELECT 
    'Políticas Activas:' as section,
    CONCAT(
        (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'categories')::text,
        ' políticas (esperadas: 4)'
    ) as detail
UNION ALL
SELECT 
    'Función Helper:' as section,
    CASE 
        WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'user_has_category_write_permission')
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as detail
UNION ALL
SELECT 
    'Categorías:' as section,
    CONCAT(
        (SELECT COUNT(*) FROM public.categories)::text,
        ' registros'
    ) as detail;

-- 8. Test de acceso básico (comentado para seguridad)
-- Descomenta estas líneas para probar permisos:

-- Test SELECT (debería funcionar para todos los usuarios autenticados)
-- SELECT 'TEST SELECT' as test, COUNT(*) as result FROM public.categories;

-- Test INSERT (solo para usuarios con permisos de escritura)
-- INSERT INTO public.categories (name, description) 
-- VALUES ('TEST_CATEGORY_' || extract(epoch from now())::text, 'Categoría de prueba');

-- Test UPDATE (solo para usuarios con permisos de escritura)
-- UPDATE public.categories 
-- SET description = 'Descripción actualizada - ' || now()::text
-- WHERE name LIKE 'TEST_CATEGORY_%';

-- Test DELETE (solo para usuarios con permisos de escritura)
-- DELETE FROM public.categories 
-- WHERE name LIKE 'TEST_CATEGORY_%';

-- 9. Información adicional para debugging
SELECT 
    'INFORMACIÓN DE DEBUG' as section,
    '' as detail
UNION ALL
SELECT 
    '=====================' as section,
    '' as detail
UNION ALL
SELECT 
    'Usuario actual:' as section,
    COALESCE(auth.uid()::text, 'NO AUTENTICADO') as detail
UNION ALL
SELECT 
    'Rol en auth:' as section,
    COALESCE(auth.role()::text, 'NINGUNO') as detail;