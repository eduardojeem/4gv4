-- =====================================================
-- CONFIGURACIÓN DE SUPABASE CON ROW LEVEL SECURITY
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLAS PRINCIPALES
-- =====================================================

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  department TEXT,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de roles de usuario
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'employee', 'viewer')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabla de permisos personalizados por usuario
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_id TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de productos (si no existe)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  category TEXT,
  supplier TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER,
  location TEXT,
  barcode TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM user_roles 
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar permisos
CREATE OR REPLACE FUNCTION has_permission(permission_name TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Obtener rol del usuario
  user_role := get_user_role(user_uuid);
  
  -- Super admin tiene todos los permisos
  IF user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar permisos específicos por rol
  CASE user_role
    WHEN 'admin' THEN
      RETURN permission_name NOT LIKE 'system.%';
    WHEN 'manager' THEN
      RETURN permission_name IN (
        'products.read', 'products.create', 'products.update',
        'inventory.read', 'inventory.update', 'inventory.manage',
        'reports.read', 'reports.create'
      );
    WHEN 'employee' THEN
      RETURN permission_name IN (
        'products.read', 'products.update',
        'inventory.read', 'inventory.update'
      );
    WHEN 'viewer' THEN
      RETURN permission_name IN ('products.read', 'inventory.read', 'reports.read');
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si puede gestionar otro usuario
CREATE OR REPLACE FUNCTION can_manage_user(target_role TEXT, manager_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  manager_role TEXT;
  role_levels JSONB := '{
    "viewer": 1,
    "employee": 2,
    "manager": 3,
    "admin": 4,
    "super_admin": 5
  }';
BEGIN
  manager_role := get_user_role(manager_uuid);
  
  -- Solo puede gestionar usuarios con nivel inferior
  RETURN (role_levels->>manager_role)::INTEGER > (role_levels->>target_role)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Función para auditoría automática
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_values)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, old_values, new_values)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, old_values)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id::TEXT, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers de auditoría
DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_user_roles_trigger ON user_roles;
CREATE TRIGGER audit_user_roles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS PARA PROFILES
-- =====================================================

-- Los usuarios pueden ver y editar su propio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    get_user_role() IN ('admin', 'super_admin')
  );

-- Admins pueden actualizar perfiles
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    get_user_role() IN ('admin', 'super_admin')
  );

-- Permitir inserción de perfiles (para registro)
CREATE POLICY "Allow profile creation" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- POLÍTICAS RLS PARA USER_ROLES
-- =====================================================

-- Solo admins pueden ver roles
CREATE POLICY "Admins can view user roles" ON user_roles
  FOR SELECT USING (
    get_user_role() IN ('admin', 'super_admin')
  );

-- Solo super_admin puede gestionar roles de admin
CREATE POLICY "Super admin can manage admin roles" ON user_roles
  FOR ALL USING (
    get_user_role() = 'super_admin' OR 
    (get_user_role() = 'admin' AND role != 'super_admin' AND role != 'admin')
  );

-- =====================================================
-- POLÍTICAS RLS PARA USER_PERMISSIONS
-- =====================================================

-- Solo admins pueden gestionar permisos personalizados
CREATE POLICY "Admins can manage user permissions" ON user_permissions
  FOR ALL USING (
    get_user_role() IN ('admin', 'super_admin')
  );

-- =====================================================
-- POLÍTICAS RLS PARA AUDIT_LOG
-- =====================================================

-- Solo admins pueden ver logs de auditoría
CREATE POLICY "Admins can view audit logs" ON audit_log
  FOR SELECT USING (
    get_user_role() IN ('admin', 'super_admin')
  );

-- Todos pueden insertar en audit log (para el sistema)
CREATE POLICY "Allow audit log insertion" ON audit_log
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS PARA PRODUCTS
-- =====================================================

-- Lectura de productos según permisos
CREATE POLICY "Read products with permission" ON products
  FOR SELECT USING (
    has_permission('products.read')
  );

-- Creación de productos
CREATE POLICY "Create products with permission" ON products
  FOR INSERT WITH CHECK (
    has_permission('products.create')
  );

-- Actualización de productos
CREATE POLICY "Update products with permission" ON products
  FOR UPDATE USING (
    has_permission('products.update')
  );

-- Eliminación de productos
CREATE POLICY "Delete products with permission" ON products
  FOR DELETE USING (
    has_permission('products.delete')
  );

-- =====================================================
-- FUNCIONES PARA GESTIÓN DE USUARIOS
-- =====================================================

-- Función para asignar rol por defecto a nuevos usuarios
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar usuario super admin inicial (opcional)
-- NOTA: Ejecutar esto solo después de crear el primer usuario en Supabase Auth
/*
INSERT INTO user_roles (user_id, role) 
VALUES ('YOUR_FIRST_USER_UUID', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
*/

-- =====================================================
-- ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

-- Para completar la configuración:
-- 1. Ejecutar este script en el SQL Editor de Supabase
-- 2. Crear el primer usuario a través de la interfaz de autenticación
-- 3. Actualizar el UUID del primer usuario en la inserción de super_admin
-- 4. Configurar las variables de entorno en tu aplicación Next.js
-- 5. Implementar el AuthProvider en tu aplicación

COMMENT ON TABLE profiles IS 'Perfiles extendidos de usuarios';
COMMENT ON TABLE user_roles IS 'Roles asignados a usuarios';
COMMENT ON TABLE user_permissions IS 'Permisos personalizados por usuario';
COMMENT ON TABLE audit_log IS 'Registro de auditoría del sistema';
COMMENT ON FUNCTION get_user_role(UUID) IS 'Obtiene el rol del usuario especificado';
COMMENT ON FUNCTION has_permission(TEXT, UUID) IS 'Verifica si el usuario tiene el permiso especificado';
COMMENT ON FUNCTION can_manage_user(TEXT, UUID) IS 'Verifica si el usuario puede gestionar otro usuario con el rol especificado';