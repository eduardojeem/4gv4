-- =====================================================
-- FIX COMPLETO: Eliminar Recursión en Profiles
-- =====================================================
-- Fecha: 2026-01-14
-- Ejecutar TODO este archivo en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PARTE 1: Funciones que usan JWT (sin recursión)
-- =====================================================

-- Función principal: obtener rol desde JWT
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    'cliente'
  )::text;
$$;

-- Alias para compatibilidad
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role();
$$;

-- Funciones de verificación de roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('admin','super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('manager','vendedor');
$$;

CREATE OR REPLACE FUNCTION public.is_cashier()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() = 'cashier';
$$;

CREATE OR REPLACE FUNCTION public.is_technician()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('technician','tecnico');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('admin','super_admin','manager','vendedor','tecnico','technician','cashier');
$$;

-- Limpiar funciones antiguas problemáticas
DROP FUNCTION IF EXISTS public.is_admin_safe() CASCADE;

-- =====================================================
-- PARTE 2: Trigger para sincronizar rol con JWT
-- =====================================================

-- Función que sincroniza profiles.role con auth.users
CREATE OR REPLACE FUNCTION public.sync_role_to_auth_metadata()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS sync_role_to_jwt_trigger ON public.profiles;

CREATE TRIGGER sync_role_to_jwt_trigger
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_auth_metadata();

-- Sincronizar roles existentes
DO $$
DECLARE
  profile_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR profile_record IN 
    SELECT id, role FROM public.profiles WHERE role IS NOT NULL
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', profile_record.role)
    WHERE id = profile_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ Sincronizados % perfiles con JWT', updated_count;
END $$;

-- =====================================================
-- PARTE 3: Políticas RLS sin recursión
-- =====================================================

-- Eliminar TODAS las políticas antiguas
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view department users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Administradores pueden ver todos los perfiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- Asegurar que RLS esté habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crear políticas correctas (sin recursión)
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_select_staff"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_staff());

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "profiles_insert_admin"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE TO authenticated
USING (public.is_admin());

-- Asegurar permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- =====================================================
-- PARTE 4: Función para promover usuario a admin
-- =====================================================

CREATE OR REPLACE FUNCTION public.promote_current_user_to_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Actualizar profiles (trigger sincroniza con JWT)
  INSERT INTO public.profiles(id, role, updated_at)
  VALUES (uid, 'admin', NOW())
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', updated_at = EXCLUDED.updated_at;

  -- Actualizar user_roles si existe la tabla
  INSERT INTO public.user_roles(user_id, role, is_active, updated_at)
  VALUES (uid, 'admin', TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE 
  SET role = 'admin', is_active = TRUE, updated_at = EXCLUDED.updated_at;

  -- Actualizar JWT directamente
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', 'admin')
  WHERE id = uid;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_current_user_to_admin() TO authenticated;

-- =====================================================
-- PARTE 5: Verificación final
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
  has_recursion BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '=== Verificando Políticas RLS ===';
  
  FOR policy_record IN 
    SELECT policyname, qual::text as using_clause
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    IF policy_record.using_clause LIKE '%profiles%' THEN
      RAISE WARNING '❌ RECURSIÓN en: %', policy_record.policyname;
      has_recursion := TRUE;
    ELSE
      RAISE NOTICE '✅ OK: %', policy_record.policyname;
    END IF;
  END LOOP;
  
  IF has_recursion THEN
    RAISE WARNING '⚠️ Se detectaron políticas con recursión';
  ELSE
    RAISE NOTICE '✅ Todas las políticas están correctas';
  END IF;
END $$;

-- Mostrar resumen
SELECT 
  policyname,
  cmd as tipo,
  CASE 
    WHEN qual::text LIKE '%profiles%' THEN '❌ RECURSIÓN'
    ELSE '✅ OK'
  END as estado
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- =====================================================
-- FIN - Migración completada
-- =====================================================
-- Próximos pasos:
-- 1. Hacer logout/login en la aplicación
-- 2. Verificar que no aparezca error de recursión
-- =====================================================
