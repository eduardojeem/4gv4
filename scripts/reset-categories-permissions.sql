-- =====================================================
-- SCRIPT: Reset Categories Permissions (EMERGENCY)
-- Date: 2025-01-07
-- Description: Script de emergencia para resetear completamente los permisos de categorías
-- ⚠️  USAR SOLO EN CASO DE EMERGENCIA - ELIMINA TODAS LAS POLÍTICAS
-- =====================================================

-- 1. Advertencia de seguridad
DO $ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ADVERTENCIA: SCRIPT DE EMERGENCIA';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Este script eliminará TODAS las políticas RLS de categories';
    RAISE NOTICE 'y creará permisos básicos para todos los usuarios autenticados.';
    RAISE NOTICE '';
    RAISE NOTICE 'Continúa en 3 segundos...';
    PERFORM pg_sleep(3);
END $;

-- 2. Deshabilitar RLS temporalmente
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
RAISE NOTICE '✓ RLS deshabilitado temporalmente';

-- 3. Eliminar TODAS las políticas existentes
DO $ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'categories'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.categories', policy_record.policyname);
        RAISE NOTICE '✓ Política eliminada: %', policy_record.policyname;
    END LOOP;
END $;

-- 4. Eliminar función helper si existe
DROP FUNCTION IF EXISTS public.user_has_category_write_permission();
RAISE NOTICE '✓ Función helper eliminada';

-- 5. Volver a habilitar RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
RAISE NOTICE '✓ RLS habilitado nuevamente';

-- 6. Crear política simple: PERMITIR TODO a usuarios autenticados
CREATE POLICY "emergency_allow_all_categories" 
ON public.categories 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

RAISE NOTICE '✓ Política de emergencia creada: acceso completo para usuarios autenticados';

-- 7. Otorgar permisos básicos
GRANT ALL ON public.categories TO authenticated;
RAISE NOTICE '✓ Permisos básicos otorgados';

-- 8. Verificar que la tabla es accesible
DO $ 
DECLARE
    categories_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO categories_count FROM public.categories;
    RAISE NOTICE '✓ Verificación: % categorías encontradas', categories_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error al acceder a categories: %', SQLERRM;
END $;

-- 9. Insertar categorías básicas si no existen
INSERT INTO public.categories (name, description) 
VALUES 
    ('General', 'Categoría general'),
    ('Productos', 'Productos diversos'),
    ('Servicios', 'Servicios ofrecidos')
ON CONFLICT (name) DO NOTHING;

RAISE NOTICE '✓ Categorías básicas insertadas';

-- 10. Resumen final
DO $ 
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'categories';
    
    RAISE NOTICE '';
    RAISE NOTICE '🚨 RESET DE EMERGENCIA COMPLETADO';
    RAISE NOTICE '===============================';
    RAISE NOTICE '✓ Todas las políticas anteriores eliminadas';
    RAISE NOTICE '✓ Política de emergencia creada (% políticas activas)', policy_count;
    RAISE NOTICE '✓ Acceso completo para usuarios autenticados';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASOS:';
    RAISE NOTICE '1. Verificar que la aplicación funciona correctamente';
    RAISE NOTICE '2. Ejecutar el script principal de permisos cuando sea seguro:';
    RAISE NOTICE '   supabase/migrations/20250107_fix_categories_permissions.sql';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Para verificar el estado actual:';
    RAISE NOTICE '   SELECT * FROM pg_policies WHERE tablename = ''categories'';';
END $;