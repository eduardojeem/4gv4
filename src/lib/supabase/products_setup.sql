-- =====================================================
-- TABLAS ADICIONALES PARA GESTIÓN DE PRODUCTOS
-- =====================================================

-- 1. Tabla de CATEGORÍAS
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de PROVEEDORES
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de MARCAS (Opcional, pero recomendada)
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de MOVIMIENTOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'RETURN')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  reference_id TEXT, -- ID de venta, orden de compra, etc.
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MODIFICACIÓN DE TABLA PRODUCTS (Migración)
-- =====================================================

-- Agregar columnas de claves foráneas
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Políticas para CATEGORIES
CREATE POLICY "Read categories public" ON categories FOR SELECT USING (true);
CREATE POLICY "Manage categories admin" ON categories FOR ALL USING (
  has_permission('inventory.manage') OR get_user_role() IN ('admin', 'super_admin')
);

-- Políticas para SUPPLIERS
CREATE POLICY "Read suppliers staff" ON suppliers FOR SELECT USING (
  get_user_role() IN ('admin', 'super_admin', 'manager', 'employee')
);
CREATE POLICY "Manage suppliers admin" ON suppliers FOR ALL USING (
  has_permission('inventory.manage') OR get_user_role() IN ('admin', 'super_admin')
);

-- Políticas para BRANDS
CREATE POLICY "Read brands public" ON brands FOR SELECT USING (true);
CREATE POLICY "Manage brands admin" ON brands FOR ALL USING (
  has_permission('inventory.manage') OR get_user_role() IN ('admin', 'super_admin')
);

-- Políticas para INVENTORY_MOVEMENTS
CREATE POLICY "Read movements staff" ON inventory_movements FOR SELECT USING (
  get_user_role() IN ('admin', 'super_admin', 'manager', 'employee')
);
CREATE POLICY "Create movements staff" ON inventory_movements FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'super_admin', 'manager', 'employee')
);

-- =====================================================
-- TRIGGERS DE ACTUALIZACIÓN
-- =====================================================

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGERS DE AUDITORÍA
-- =====================================================

CREATE TRIGGER audit_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_suppliers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_brands_trigger
  AFTER INSERT OR UPDATE OR DELETE ON brands
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_inventory_movements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
