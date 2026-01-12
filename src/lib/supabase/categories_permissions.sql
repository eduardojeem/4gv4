-- =====================================================
-- CORRECCIÓN Y MEJORA DE PERMISOS PARA CATEGORÍAS
-- =====================================================

-- 0. Asegurar que existe la función de auditoría
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

-- 1. Crear tabla de categorías si no existe
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 2. Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- 3. Actualizar función has_permission para incluir categorías explícitamente
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
        'products.read', 'products.create', 'products.update', 'products.delete',
        'categories.read', 'categories.create', 'categories.update', 'categories.delete',
        'inventory.read', 'inventory.update', 'inventory.manage',
        'reports.read', 'reports.create'
      );
      
    WHEN 'vendedor' THEN
      RETURN permission_name IN (
        'products.read', 'products.create', 'products.update',
        'categories.read',
        'inventory.read', 'inventory.update',
        'reports.read', 'reports.create'
      );
      
    WHEN 'employee' THEN
      RETURN permission_name IN (
        'products.read', 'products.update',
        'categories.read',
        'inventory.read', 'inventory.update'
      );
      
    WHEN 'viewer' THEN
      RETURN permission_name IN ('products.read', 'categories.read', 'inventory.read', 'reports.read');
      
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Definir políticas RLS para categorías

-- Lectura: Todos con permiso categories.read o products.read pueden ver
DROP POLICY IF EXISTS "Read categories with permission" ON categories;
CREATE POLICY "Read categories with permission" ON categories
  FOR SELECT USING (
    has_permission('categories.read') OR has_permission('products.read')
  );

-- Creación: Solo con permiso products.create o categories.create
DROP POLICY IF EXISTS "Create categories with permission" ON categories;
CREATE POLICY "Create categories with permission" ON categories
  FOR INSERT WITH CHECK (
    has_permission('categories.create') OR has_permission('products.create')
  );

-- Actualización: Solo con permiso products.update o categories.update
DROP POLICY IF EXISTS "Update categories with permission" ON categories;
CREATE POLICY "Update categories with permission" ON categories
  FOR UPDATE USING (
    has_permission('categories.update') OR has_permission('products.update')
  );

-- Eliminación: Solo con permiso products.delete o categories.delete
DROP POLICY IF EXISTS "Delete categories with permission" ON categories;
CREATE POLICY "Delete categories with permission" ON categories
  FOR DELETE USING (
    has_permission('categories.delete') OR has_permission('products.delete')
  );

-- 5. Trigger de auditoría para categorías
DROP TRIGGER IF EXISTS audit_categories_trigger ON categories;
CREATE TRIGGER audit_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 6. Comentarios de documentación
COMMENT ON TABLE categories IS 'Categorías jerárquicas de productos';
