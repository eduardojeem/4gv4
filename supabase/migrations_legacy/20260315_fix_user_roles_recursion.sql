-- Fix infinite recursion in user_roles policy
-- 2026-03-15

-- 1. Ensure get_user_role is SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- First try to get role from user_roles (active)
  SELECT role INTO v_role
  FROM public.user_roles 
  WHERE user_id = user_uuid 
    AND (is_active IS NULL OR is_active = TRUE)
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  -- Fallback to profiles if not found in user_roles
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = user_uuid;
  END IF;

  RETURN COALESCE(v_role, 'cliente');
END;
$$;

-- 2. Ensure has_permission is SECURITY DEFINER and includes modern roles
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
  user_role := public.get_user_role(user_uuid);
  
  -- Super admin has all permissions
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
      -- Default/Client has no administrative permissions
      RETURN FALSE;
  END CASE;

  RETURN permission_name = ANY(role_permissions);
END;
$$;

-- 3. Update user_roles policies to avoid recursion loop
-- Split "view own role" from "admin view roles" to avoid calling has_permission() for self

DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_permission('users.read'));

-- 4. Ensure admin manage policy exists
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_permission('users.manage'));
