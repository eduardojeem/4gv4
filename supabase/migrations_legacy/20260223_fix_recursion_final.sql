-- Fix infinite recursion in profiles RLS policies
-- This migration removes the recursive policy introduced in the previous migration
-- and replaces it with a safe version using JWT claims

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. Ensure helper functions exist (safe versions using JWT)
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

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'vendedor');
$$;

-- 3. Create the safe policy
CREATE POLICY "Admins and Managers can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
    public.is_admin_or_manager()
    OR auth.uid() = id
);

-- 4. Ensure the trigger to sync role to JWT exists (crucial for this to work)
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

DROP TRIGGER IF EXISTS sync_role_to_jwt_trigger ON public.profiles;
CREATE TRIGGER sync_role_to_jwt_trigger
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_auth_metadata();

-- 5. Force sync roles for existing users to ensure JWTs are up to date
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT id, role FROM public.profiles WHERE role IS NOT NULL
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', profile_record.role)
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Política recursiva eliminada y reemplazada por versión segura';
    RAISE NOTICE '✅ Roles sincronizados con JWT metadata';
END $$;
