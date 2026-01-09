-- =====================================================
-- SCRIPT: Reset Categories Permissions (Supabase Compatible)
-- Date: 2025-01-07
-- Description: Script de emergencia para resetear permisos de categorías
-- Compatible con Supabase SQL Editor
-- ⚠️  USAR SOLO EN CASO DE EMERGENCIA
-- =====================================================

-- 1. Deshabilitar RLS temporalmente
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes
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

-- 3. Eliminar función helper si existe
DROP FUNCTION IF EXISTS public.user_has_category_write_permission();

-- 4. Volver a habilitar RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 5. Crear política simple: PERMITIR TODO a usuarios autenticados
CREATE POLICY "emergency_allow_all_categories" 
ON public.categories 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 6. Otorgar permisos básicos
GRANT ALL ON public.categories TO authenticated;

-- 7. Insertar categorías básicas si no existen
INSERT INTO public.categories (name, description) 
VALUES 
    ('General', 'Categoría general'),
    ('Productos', 'Productos diversos'),
    ('Servicios', 'Servicios ofrecidos')
ON CONFLICT (name) DO NOTHING;

-- 8. Verificación manual
-- Ejecutar estas consultas para verificar:
-- SELECT * FROM pg_policies WHERE tablename = 'categories';
-- SELECT COUNT(*) FROM public.categories;