-- =====================================================
-- PERMISOS Y TABLA PARA EL SISTEMA DE PROMOCIONES
-- =====================================================

-- 1. Crear tabla de promociones si no existe
CREATE TABLE IF NOT EXISTS promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC NOT NULL CHECK (value >= 0),
  min_purchase NUMERIC DEFAULT 0 CHECK (min_purchase >= 0),
  max_discount NUMERIC CHECK (max_discount >= 0),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit >= 0),
  applicable_products TEXT[], -- Array de IDs de productos
  applicable_categories TEXT[], -- Array de IDs de categorías
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en promotions
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- 2. Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);

-- 3. Actualizar función has_permission para incluir promociones
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
        'promotions.read', 'promotions.create', 'promotions.update', 'promotions.delete',
        'inventory.read', 'inventory.update', 'inventory.manage',
        'reports.read', 'reports.create'
      );
      
    WHEN 'vendedor' THEN
      RETURN permission_name IN (
        'products.read', 'products.create', 'products.update',
        'categories.read',
        'promotions.read', 'promotions.create', 'promotions.update',
        'inventory.read', 'inventory.update',
        'reports.read', 'reports.create'
      );
      
    WHEN 'employee' THEN
      RETURN permission_name IN (
        'products.read', 'products.update',
        'categories.read',
        'promotions.read',
        'inventory.read', 'inventory.update'
      );
      
    WHEN 'viewer' THEN
      RETURN permission_name IN ('products.read', 'categories.read', 'promotions.read', 'inventory.read', 'reports.read');
      
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Definir políticas RLS para promociones

-- Lectura: Todos con permiso promotions.read o products.read pueden ver
DROP POLICY IF EXISTS "Read promotions with permission" ON promotions;
CREATE POLICY "Read promotions with permission" ON promotions
  FOR SELECT USING (
    has_permission('promotions.read') OR has_permission('products.read')
  );

-- Creación: Solo con permiso promotions.create
DROP POLICY IF EXISTS "Create promotions with permission" ON promotions;
CREATE POLICY "Create promotions with permission" ON promotions
  FOR INSERT WITH CHECK (
    has_permission('promotions.create')
  );

-- Actualización: Solo con permiso promotions.update
DROP POLICY IF EXISTS "Update promotions with permission" ON promotions;
CREATE POLICY "Update promotions with permission" ON promotions
  FOR UPDATE USING (
    has_permission('promotions.update')
  );

-- Eliminación: Solo con permiso promotions.delete
DROP POLICY IF EXISTS "Delete promotions with permission" ON promotions;
CREATE POLICY "Delete promotions with permission" ON promotions
  FOR DELETE USING (
    has_permission('promotions.delete')
  );

-- 5. Trigger de auditoría para promociones (asegurar que audit_trigger_function existe)
-- Se asume que audit_trigger_function ya fue creada en scripts anteriores (categories_permissions.sql)
-- Si no, descomentar la creación aquí o asegurar orden de ejecución.

DROP TRIGGER IF EXISTS audit_promotions_trigger ON promotions;
CREATE TRIGGER audit_promotions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON promotions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 6. Comentarios
COMMENT ON TABLE promotions IS 'Gestión de cupones y descuentos';
