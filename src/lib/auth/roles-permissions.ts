// Sistema de roles y permisos con Row Level Security (RLS)
// Roles que coinciden con la base de datos: 'admin', 'vendedor', 'tecnico', 'cliente'
export type UserRole = 'admin' | 'vendedor' | 'tecnico' | 'cliente'

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
}

export interface RolePermissions {
  role: UserRole
  permissions: Permission[]
  description: string
  level: number
}

// Definición de permisos granulares
export const PERMISSIONS: Record<string, Permission> = {
  // Productos
  'products.create': {
    id: 'products.create',
    name: 'Crear Productos',
    description: 'Permite crear nuevos productos',
    resource: 'products',
    action: 'create'
  },
  'products.read': {
    id: 'products.read',
    name: 'Ver Productos',
    description: 'Permite ver la lista de productos',
    resource: 'products',
    action: 'read'
  },
  'products.update': {
    id: 'products.update',
    name: 'Editar Productos',
    description: 'Permite modificar productos existentes',
    resource: 'products',
    action: 'update'
  },
  'products.delete': {
    id: 'products.delete',
    name: 'Eliminar Productos',
    description: 'Permite eliminar productos',
    resource: 'products',
    action: 'delete'
  },
  'products.manage': {
    id: 'products.manage',
    name: 'Gestionar Productos',
    description: 'Control total sobre productos',
    resource: 'products',
    action: 'manage'
  },

  // Inventario
  'inventory.read': {
    id: 'inventory.read',
    name: 'Ver Inventario',
    description: 'Permite ver niveles de stock',
    resource: 'inventory',
    action: 'read'
  },
  'inventory.update': {
    id: 'inventory.update',
    name: 'Actualizar Inventario',
    description: 'Permite modificar niveles de stock',
    resource: 'inventory',
    action: 'update'
  },
  'inventory.manage': {
    id: 'inventory.manage',
    name: 'Gestionar Inventario',
    description: 'Control total sobre inventario',
    resource: 'inventory',
    action: 'manage'
  },

  // Reportes
  'reports.read': {
    id: 'reports.read',
    name: 'Ver Reportes',
    description: 'Permite ver reportes básicos',
    resource: 'reports',
    action: 'read'
  },
  'reports.create': {
    id: 'reports.create',
    name: 'Crear Reportes',
    description: 'Permite generar reportes personalizados',
    resource: 'reports',
    action: 'create'
  },
  'reports.manage': {
    id: 'reports.manage',
    name: 'Gestionar Reportes',
    description: 'Control total sobre reportes',
    resource: 'reports',
    action: 'manage'
  },

  // Usuarios
  'users.read': {
    id: 'users.read',
    name: 'Ver Usuarios',
    description: 'Permite ver lista de usuarios',
    resource: 'users',
    action: 'read'
  },
  'users.create': {
    id: 'users.create',
    name: 'Crear Usuarios',
    description: 'Permite crear nuevos usuarios',
    resource: 'users',
    action: 'create'
  },
  'users.update': {
    id: 'users.update',
    name: 'Editar Usuarios',
    description: 'Permite modificar usuarios',
    resource: 'users',
    action: 'update'
  },
  'users.delete': {
    id: 'users.delete',
    name: 'Eliminar Usuarios',
    description: 'Permite eliminar usuarios',
    resource: 'users',
    action: 'delete'
  },
  'users.manage': {
    id: 'users.manage',
    name: 'Gestionar Usuarios',
    description: 'Control total sobre usuarios',
    resource: 'users',
    action: 'manage'
  },

  // Configuración
  'settings.read': {
    id: 'settings.read',
    name: 'Ver Configuración',
    description: 'Permite ver configuraciones',
    resource: 'settings',
    action: 'read'
  },
  'settings.update': {
    id: 'settings.update',
    name: 'Editar Configuración',
    description: 'Permite modificar configuraciones',
    resource: 'settings',
    action: 'update'
  },
  'settings.manage': {
    id: 'settings.manage',
    name: 'Gestionar Configuración',
    description: 'Control total sobre configuraciones',
    resource: 'settings',
    action: 'manage'
  },

  // Promociones
  'promotions.read': {
    id: 'promotions.read',
    name: 'Ver Promociones',
    description: 'Permite ver la lista de promociones',
    resource: 'promotions',
    action: 'read'
  },
  'promotions.create': {
    id: 'promotions.create',
    name: 'Crear Promociones',
    description: 'Permite crear nuevas promociones',
    resource: 'promotions',
    action: 'create'
  },
  'promotions.update': {
    id: 'promotions.update',
    name: 'Editar Promociones',
    description: 'Permite modificar promociones existentes',
    resource: 'promotions',
    action: 'update'
  },
  'promotions.delete': {
    id: 'promotions.delete',
    name: 'Eliminar Promociones',
    description: 'Permite eliminar promociones',
    resource: 'promotions',
    action: 'delete'
  },
  'promotions.manage': {
    id: 'promotions.manage',
    name: 'Gestionar Promociones',
    description: 'Control total sobre promociones',
    resource: 'promotions',
    action: 'manage'
  }
}

// Configuración de roles con sus permisos
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    description: 'Administrador con acceso completo al sistema',
    level: 4,
    permissions: Object.values(PERMISSIONS)
  },
  vendedor: {
    role: 'vendedor',
    description: 'Vendedor con permisos de ventas y productos',
    level: 3,
    permissions: [
      PERMISSIONS['products.create'],
      PERMISSIONS['products.read'],
      PERMISSIONS['products.update'],
      PERMISSIONS['inventory.read'],
      PERMISSIONS['inventory.update'],
      PERMISSIONS['reports.read'],
      PERMISSIONS['reports.create'],
      PERMISSIONS['promotions.read'],
      PERMISSIONS['promotions.create'],
      PERMISSIONS['promotions.update']
    ]
  },
  tecnico: {
    role: 'tecnico',
    description: 'Técnico con permisos básicos de productos e inventario',
    level: 2,
    permissions: [
      PERMISSIONS['products.read'],
      PERMISSIONS['products.update'],
      PERMISSIONS['inventory.read'],
      PERMISSIONS['inventory.update'],
      PERMISSIONS['reports.read']
    ]
  },
  cliente: {
    role: 'cliente',
    description: 'Cliente con acceso de solo lectura',
    level: 1,
    permissions: [
      PERMISSIONS['products.read'],
      PERMISSIONS['inventory.read'],
      PERMISSIONS['reports.read']
    ]
  }
}

// Funciones de utilidad para verificar permisos
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole]
  return rolePermissions.permissions.some(p => p.id === permission)
}

export function hasResourceAccess(userRole: UserRole, resource: string, action: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole]
  return rolePermissions.permissions.some(p => 
    p.resource === resource && (p.action === action || p.action === 'manage')
  )
}

export function canAccessResource(userRole: UserRole, resource: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole]
  return rolePermissions.permissions.some(p => p.resource === resource)
}

export function getRoleLevel(role: UserRole): number {
  return ROLE_PERMISSIONS[role].level
}

export function canManageUser(managerRole: UserRole, targetRole: UserRole): boolean {
  return getRoleLevel(managerRole) > getRoleLevel(targetRole)
}

// SQL para crear las tablas y políticas RLS en Supabase
export const SUPABASE_RLS_SETUP = `
-- Crear tabla de roles de usuario
CREATE TABLE IF NOT EXISTS user_roles (
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

-- Crear tabla de permisos personalizados
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
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

-- Habilitar RLS en todas las tablas
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM user_roles 
    WHERE user_id = user_uuid 
    AND is_active = TRUE 
    AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar permisos
CREATE OR REPLACE FUNCTION has_permission(permission_name TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_permissions TEXT[];
BEGIN
  -- Obtener rol del usuario
  user_role := get_user_role(user_uuid);
  
  -- Definir permisos por rol
  CASE user_role
    WHEN 'super_admin' THEN
      RETURN TRUE; -- Super admin tiene todos los permisos
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
  
  -- Verificar si el permiso está en la lista
  RETURN permission_name = ANY(role_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS para productos
DROP POLICY IF EXISTS "Users can view products based on role" ON products;
CREATE POLICY "Users can view products based on role" ON products
  FOR SELECT USING (has_permission('products.read'));

DROP POLICY IF EXISTS "Users can insert products based on role" ON products;
CREATE POLICY "Users can insert products based on role" ON products
  FOR INSERT WITH CHECK (has_permission('products.create'));

DROP POLICY IF EXISTS "Users can update products based on role" ON products;
CREATE POLICY "Users can update products based on role" ON products
  FOR UPDATE USING (has_permission('products.update'));

DROP POLICY IF EXISTS "Users can delete products based on role" ON products;
CREATE POLICY "Users can delete products based on role" ON products
  FOR DELETE USING (has_permission('products.delete'));

-- Políticas RLS para roles de usuario
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid() OR has_permission('users.read'));

DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage user roles" ON user_roles
  FOR ALL USING (has_permission('users.manage'));

-- Políticas RLS para permisos de usuario
DROP POLICY IF EXISTS "Users can view permissions" ON user_permissions;
CREATE POLICY "Users can view permissions" ON user_permissions
  FOR SELECT USING (user_id = auth.uid() OR has_permission('users.read'));

DROP POLICY IF EXISTS "Admins can manage permissions" ON user_permissions;
CREATE POLICY "Admins can manage permissions" ON user_permissions
  FOR ALL USING (has_permission('users.manage'));

-- Políticas RLS para auditoría
DROP POLICY IF EXISTS "Users can view audit logs" ON audit_log;
CREATE POLICY "Users can view audit logs" ON audit_log
  FOR SELECT USING (has_permission('settings.read'));

-- Función para registrar auditoría
CREATE OR REPLACE FUNCTION log_audit(
  action_name TEXT,
  resource_name TEXT,
  resource_id_val TEXT DEFAULT NULL,
  old_vals JSONB DEFAULT NULL,
  new_vals JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, resource, resource_id, old_values, new_values)
  VALUES (auth.uid(), action_name, resource_name, resource_id_val, old_vals, new_vals);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para auditoría automática en productos
CREATE OR REPLACE FUNCTION audit_products_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit('CREATE', 'products', NEW.id::TEXT, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit('UPDATE', 'products', NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit('DELETE', 'products', OLD.id::TEXT, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_products_changes();

-- Crear usuario administrador por defecto (ejecutar después de la autenticación)
-- INSERT INTO user_roles (user_id, role, assigned_by) 
-- VALUES (auth.uid(), 'super_admin', auth.uid())
-- ON CONFLICT (user_id) DO NOTHING;
`;

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasResourceAccess,
  canAccessResource,
  getRoleLevel,
  canManageUser,
  SUPABASE_RLS_SETUP
}