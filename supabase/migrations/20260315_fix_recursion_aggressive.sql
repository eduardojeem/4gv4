
-- Aggressive fix for infinite recursion in user_roles policy
-- 2026-03-15 Part 2

-- 1. Drop ALL policies on user_roles to ensure clean slate
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

-- 2. Drop ALL policies on user_permissions (just in case)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_permissions' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_permissions', pol.policyname);
  END LOOP;
END $$;

-- 3. Redefine functions with explicit OWNER TO postgres (superuser) to ensure SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Direct query to user_roles (bypasses RLS due to SECURITY DEFINER + postgres owner)
  SELECT role INTO v_role
  FROM public.user_roles 
  WHERE user_id = user_uuid 
    AND (is_active IS NULL OR is_active = TRUE)
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  -- Fallback to profiles
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = user_uuid;
  END IF;

  RETURN COALESCE(v_role, 'cliente');
END;
$$;

ALTER FUNCTION public.get_user_role(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.has_permission(permission_name TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
  role_permissions TEXT[];
BEGIN
  -- This call is safe because get_user_role is SECURITY DEFINER
  user_role := public.get_user_role(user_uuid);
  
  IF user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Permissions matrix
  CASE user_role
    WHEN 'admin' THEN
      role_permissions := ARRAY[
        'products.manage', 'inventory.manage', 'reports.manage',
        'users.read', 'users.create', 'users.update', 'users.manage', 'users.delete',
        'settings.read', 'settings.update', 'settings.manage'
      ];
    WHEN 'manager' THEN
      role_permissions := ARRAY[
        'products.create', 'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read', 'reports.create',
        'users.read', 'settings.read'
      ];
    WHEN 'vendedor' THEN
      role_permissions := ARRAY[
        'products.read', 'products.update', 'products.create',
        'sales.create', 'sales.read', 'sales.update',
        'inventory.read', 'inventory.update',
        'reports.read', 'promotions.create', 'promotions.read', 'promotions.update',
        'users.read'
      ];
    WHEN 'tecnico' THEN
      role_permissions := ARRAY[
        'products.read', 'products.update',
        'repairs.create', 'repairs.read', 'repairs.update',
        'inventory.read', 'inventory.update',
        'reports.read'
      ];
    WHEN 'employee' THEN
      role_permissions := ARRAY[
        'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read'
      ];
    WHEN 'viewer' THEN
      role_permissions := ARRAY[
        'products.read', 'inventory.read', 'reports.read'
      ];
    ELSE
      RETURN FALSE;
  END CASE;

  RETURN permission_name = ANY(role_permissions);
END;
$$;

ALTER FUNCTION public.has_permission(text, uuid) OWNER TO postgres;

-- 4. Recreate policies for user_roles
-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policy for self-access (no function call)
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin policy uses has_permission (safe now)
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_permission('users.read'));

CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_permission('users.manage'));

-- 5. Recreate policies for user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (public.has_permission('users.read'));

CREATE POLICY "Admins can manage permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_permission('users.manage'));

