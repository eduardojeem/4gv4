-- =====================================================
-- SCRIPT: Verificar Permisos de Categorías
-- Date: 2025-01-07
-- Description: Script para verificar que los permisos RLS funcionan correctamente
-- =====================================================

-- 1. Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'categories';

-- 2. Listar todas las políticas activas
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
WHERE schemaname = 'public' AND tablename = 'categories'
ORDER BY policyname;

-- 3. Verificar función helper
SELECT 
    proname as function_name,
    prorettype::regtype as return_type,
    prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'user_has_category_write_permission';

-- 4. Contar categorías existentes
SELECT 
    COUNT(*) as total_categories,
    STRING_AGG(name, ', ') as category_names
FROM public.categories;

-- 5. Verificar permisos de tabla
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'categories'
AND grantee = 'authenticated';

-- 6. Test de permisos (solo para referencia, no ejecutar en producción)
/*
-- Para probar permisos, ejecutar como usuario autenticado:

-- Test SELECT (debería funcionar para todos)
SELECT * FROM public.categories LIMIT 1;

-- Test INSERT (debería funcionar solo para usuarios con permisos)
INSERT INTO public.categories (name, description) 
VALUES ('Test Category', 'Categoría de prueba');

-- Test UPDATE (debería funcionar solo para usuarios con permisos)
UPDATE public.categories 
SET description = 'Descripción actualizada' 
WHERE name = 'Test Category';

-- Test DELETE (debería funcionar solo para usuarios con permisos)
DELETE FROM public.categories 
WHERE name = 'Test Category';
*/

-- 7. Verificar usuarios y roles (si existen las tablas)
DO $ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        RAISE NOTICE 'Usuarios en profiles:';
        PERFORM * FROM (
            SELECT 
                id,
                email,
                role,
                created_at
            FROM public.profiles 
            ORDER BY created_at DESC 
            LIMIT 5
        ) AS recent_users;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        RAISE NOTICE 'Roles en user_roles:';
        PERFORM * FROM (
            SELECT 
                user_id,
                role,
                created_at
            FROM public.user_roles 
            ORDER BY created_at DESC 
            LIMIT 5
        ) AS recent_roles;
    END IF;
END $;

-- 8. Resumen de verificación
DO $ 
DECLARE
    rls_enabled BOOLEAN;
    policy_count INTEGER;
    function_exists BOOLEAN;
    categories_count INTEGER;
BEGIN
    -- Verificar RLS
    SELECT rowsecurity INTO rls_enabled 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'categories';
    
    -- Contar políticas
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'categories';
    
    -- Verificar función
    SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'user_has_category_write_permission'
    ) INTO function_exists;
    
    -- Contar categorías
    SELECT COUNT(*) INTO categories_count 
    FROM public.categories;
    
    -- Mostrar resumen
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMEN DE VERIFICACIÓN DE PERMISOS';
    RAISE NOTICE '=====================================';
    RAISE NOTICE 'RLS Habilitado: %', CASE WHEN rls_enabled THEN '✅ SÍ' ELSE '❌ NO' END;
    RAISE NOTICE 'Políticas Activas: % (esperadas: 4)', policy_count;
    RAISE NOTICE 'Función Helper: %', CASE WHEN function_exists THEN '✅ EXISTE' ELSE '❌ NO EXISTE' END;
    RAISE NOTICE 'Categorías: % registros', categories_count;
    RAISE NOTICE '';
    
    IF rls_enabled AND policy_count = 4 AND function_exists AND categories_count > 0 THEN
        RAISE NOTICE '🎉 VERIFICACIÓN EXITOSA: Todos los componentes están configurados correctamente';
    ELSE
        RAISE NOTICE '⚠️  VERIFICACIÓN FALLIDA: Algunos componentes necesitan atención';
    END IF;
END $;