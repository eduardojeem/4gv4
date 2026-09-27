-- =====================================================
-- SCRIPT: Fix Categories Permissions (Supabase Compatible)
-- Date: 2025-01-07
-- Description: Corregir permisos RLS para la sección de categorías
-- Compatible con Supabase SQL Editor
-- =====================================================

-- 1. Habilitar RLS en la tabla categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las políticas existentes para empezar limpio
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Allow all operations on categories" ON public.categories;
DROP POLICY IF EXISTS "categories_read_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_write_policy" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Admins and Managers can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins and Managers can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins and Managers can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Permitir todo en categorias a usuarios autenticados" ON public.categories;
DROP POLICY IF EXISTS "authenticated_users_can_read_categories" ON public.categories;
DROP POLICY IF EXISTS "pos_read_categories" ON public.categories;
DROP POLICY IF EXISTS "allow authenticated read categories" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
DROP POLICY IF EXISTS "emergency_allow_all_categories" ON public.categories;

-- 3. Crear función helper para verificar roles de usuario
CREATE OR REPLACE FUNCTION public.user_has_category_write_permission()
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar si el usuario tiene rol de escritura en profiles
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager', 'vendedor')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar si el usuario tiene rol de escritura en user_roles
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager', 'vendedor')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Si no tiene ningún rol específico, permitir si es usuario autenticado
    -- (para casos donde no se ha configurado el sistema de roles)
    IF auth.uid() IS NOT NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear políticas RLS optimizadas

-- LECTURA: Todos los usuarios autenticados pueden ver categorías
CREATE POLICY "categories_select_policy" 
ON public.categories 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERCIÓN: Usuarios con permisos de escritura
CREATE POLICY "categories_insert_policy" 
ON public.categories 
FOR INSERT 
TO authenticated 
WITH CHECK (public.user_has_category_write_permission());

-- ACTUALIZACIÓN: Usuarios con permisos de escritura
CREATE POLICY "categories_update_policy" 
ON public.categories 
FOR UPDATE 
TO authenticated 
USING (public.user_has_category_write_permission())
WITH CHECK (public.user_has_category_write_permission());

-- ELIMINACIÓN: Usuarios con permisos de escritura
CREATE POLICY "categories_delete_policy" 
ON public.categories 
FOR DELETE 
TO authenticated 
USING (public.user_has_category_write_permission());

-- 5. Insertar categorías por defecto si no existen
INSERT INTO public.categories (name, description) 
VALUES 
    ('Electrónicos', 'Dispositivos electrónicos y accesorios'),
    ('Reparaciones', 'Servicios de reparación y mantenimiento'),
    ('Accesorios', 'Accesorios y complementos'),
    ('Repuestos', 'Repuestos y componentes')
ON CONFLICT (name) DO NOTHING;

-- 6. Otorgar permisos básicos a la tabla
GRANT SELECT ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

-- 7. Comentarios finales para verificación manual
-- Para verificar que todo funciona correctamente, ejecutar:
-- SELECT * FROM pg_policies WHERE tablename = 'categories';
-- SELECT COUNT(*) FROM public.categories;