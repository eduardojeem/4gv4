-- FIX INFINITE RECURSION IN PROFILES RLS

-- 1. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- 2. Create a SECURITY DEFINER function to safely check admin status
-- This bypasses RLS on the queried tables, preventing recursion
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN 
SET search_path = public
AS $$
BEGIN
  -- Check user_roles table first (preferred source of truth)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: Check profiles table. Since this is SECURITY DEFINER, 
  -- it runs with the privileges of the creator (usually postgres), bypassing RLS.
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create the admin policies using the safe function
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  public.is_admin_safe()
);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
TO authenticated 
USING (
  public.is_admin_safe()
);

-- 4. Ensure the basic "own profile" policy exists and is simple
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = id
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = id
);

-- 5. Ensure current user is admin in user_roles (Just in case)
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

DO $$
BEGIN
    RAISE NOTICE '✅ Políticas recursivas arregladas. La verificación de administrador es ahora segura.';
END $$;
