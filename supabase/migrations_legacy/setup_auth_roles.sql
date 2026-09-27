-- Crear tablas necesarias si no existen
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'employee', 'viewer')),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Función get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT 
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.user_roles 
    WHERE user_id = user_uuid 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función has_permission
CREATE OR REPLACE FUNCTION public.has_permission(permission_name TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  role_permissions TEXT[];
BEGIN
  user_role := public.get_user_role(user_uuid);
  CASE user_role
    WHEN 'super_admin' THEN
      RETURN TRUE;
    WHEN 'admin' THEN
      role_permissions := ARRAY[
        'products.manage', 'inventory.manage', 'reports.manage',
        'users.read', 'users.create', 'users.update',
        'settings.read', 'settings.update'
      ];
    WHEN 'manager' THEN
      role_permissions := ARRAY[
        'products.create', 'products.read', 'products.update',
        'inventory.read', 'inventory.update',
        'reports.read', 'reports.create',
        'users.read', 'settings.read'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS esenciales
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.has_permission('users.read'));

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL USING (public.has_permission('users.manage'));

DROP POLICY IF EXISTS "Users can view permissions" ON public.user_permissions;
CREATE POLICY "Users can view permissions" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid() OR public.has_permission('users.read'));

DROP POLICY IF EXISTS "Admins can manage permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage permissions" ON public.user_permissions
  FOR ALL USING (public.has_permission('users.manage'));

DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_log;
CREATE POLICY "Users can view audit logs" ON public.audit_log
  FOR SELECT USING (public.has_permission('settings.read'));

