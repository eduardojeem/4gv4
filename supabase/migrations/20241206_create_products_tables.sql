-- =====================================================
-- SCRIPT DE MIGRACIÓN: Sistema de Productos
-- Fecha: 2024-12-06
-- Descripción: Crea todas las tablas necesarias para el sistema de productos
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: categories
-- Descripción: Categorías de productos
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- =====================================================
-- TABLA: suppliers
-- Descripción: Proveedores de productos
-- =====================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(50),
  address TEXT,
  tax_id VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);

-- =====================================================
-- TABLA: products
-- Descripción: Productos del inventario
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  
  -- Precios
  purchase_price DECIMAL(10, 2) DEFAULT 0,
  sale_price DECIMAL(10, 2) NOT NULL,
  wholesale_price DECIMAL(10, 2),
  offer_price DECIMAL(10, 2),
  has_offer BOOLEAN DEFAULT false,
  
  -- Inventario
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER,
  unit_measure VARCHAR(50) DEFAULT 'unidad',
  
  -- Información adicional
  barcode VARCHAR(50),
  images TEXT[], -- Array de URLs de imágenes
  image_url TEXT, -- Imagen principal (deprecated, usar images[0])
  weight DECIMAL(10, 2),
  dimensions VARCHAR(100),
  location VARCHAR(100),
  tags TEXT[],
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Índice de búsqueda de texto completo
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, '')));

-- =====================================================
-- TABLA: product_movements
-- Descripción: Movimientos de inventario
-- =====================================================
CREATE TABLE IF NOT EXISTS product_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'entrada', 'salida', 'ajuste', 'venta', 'reparacion'
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  reference_id UUID,
  reference_type VARCHAR(50), -- 'sale', 'purchase', 'repair', 'adjustment'
  notes TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para product_movements
CREATE INDEX IF NOT EXISTS idx_product_movements_product_id ON product_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_movement_type ON product_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_product_movements_created_at ON product_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_movements_reference ON product_movements(reference_id, reference_type);

-- =====================================================
-- TABLA: product_price_history
-- Descripción: Historial de cambios de precios
-- =====================================================
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'wholesale'
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  change_reason TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para product_price_history
CREATE INDEX IF NOT EXISTS idx_product_price_history_product_id ON product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_price_history_price_type ON product_price_history(price_type);
CREATE INDEX IF NOT EXISTS idx_product_price_history_created_at ON product_price_history(created_at DESC);

-- =====================================================
-- TABLA: product_alerts
-- Descripción: Alertas de productos
-- =====================================================
CREATE TABLE IF NOT EXISTS product_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'low_stock', 'out_of_stock', 'no_supplier', etc.
  message TEXT NOT NULL,
  details JSONB,
  read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para product_alerts
CREATE INDEX IF NOT EXISTS idx_product_alerts_product_id ON product_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_type ON product_alerts(type);
CREATE INDEX IF NOT EXISTS idx_product_alerts_read ON product_alerts(read);
CREATE INDEX IF NOT EXISTS idx_product_alerts_is_resolved ON product_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_product_alerts_created_at ON product_alerts(created_at DESC);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para crear movimiento de inventario automáticamente
CREATE OR REPLACE FUNCTION create_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity THEN
    INSERT INTO product_movements (
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      notes
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.stock_quantity > OLD.stock_quantity THEN 'entrada'
        WHEN NEW.stock_quantity < OLD.stock_quantity THEN 'salida'
        ELSE 'ajuste'
      END,
      ABS(NEW.stock_quantity - OLD.stock_quantity),
      OLD.stock_quantity,
      NEW.stock_quantity,
      'Ajuste automático de inventario'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para movimientos automáticos
DROP TRIGGER IF EXISTS auto_create_stock_movement ON products;
CREATE TRIGGER auto_create_stock_movement AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION create_stock_movement();

-- Función para crear alertas de stock bajo
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Alerta de stock bajo
  IF NEW.stock_quantity <= NEW.min_stock AND NEW.stock_quantity > 0 THEN
    INSERT INTO product_alerts (product_id, type, message, details)
    VALUES (
      NEW.id,
      'low_stock',
      'Stock bajo: ' || NEW.name,
      jsonb_build_object(
        'current_stock', NEW.stock_quantity,
        'min_stock', NEW.min_stock,
        'product_name', NEW.name
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Alerta de stock agotado
  IF NEW.stock_quantity = 0 THEN
    INSERT INTO product_alerts (product_id, type, message, details)
    VALUES (
      NEW.id,
      'out_of_stock',
      'Stock agotado: ' || NEW.name,
      jsonb_build_object(
        'product_name', NEW.name
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para alertas de stock
DROP TRIGGER IF EXISTS check_product_stock ON products;
CREATE TRIGGER check_product_stock AFTER INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION check_low_stock();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de productos con información completa
CREATE OR REPLACE VIEW products_full AS
SELECT 
  p.*,
  c.name as category_name,
  s.name as supplier_name,
  CASE 
    WHEN p.stock_quantity = 0 THEN 'out_of_stock'
    WHEN p.stock_quantity <= p.min_stock THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status,
  (p.sale_price - p.purchase_price) as margin,
  CASE 
    WHEN p.purchase_price > 0 THEN 
      ROUND(((p.sale_price - p.purchase_price) / p.sale_price * 100)::numeric, 2)
    ELSE 0
  END as margin_percentage,
  (p.stock_quantity * p.sale_price) as total_value
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id;

-- Vista de estadísticas de productos
CREATE OR REPLACE VIEW product_stats AS
SELECT 
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE is_active = true) as active_products,
  SUM(stock_quantity * sale_price) as total_stock_value,
  SUM(stock_quantity * purchase_price) as total_cost_value,
  SUM(stock_quantity * (sale_price - purchase_price)) as total_margin,
  COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND stock_quantity > 0) as low_stock_count,
  COUNT(*) FILTER (WHERE stock_quantity = 0) as out_of_stock_count
FROM products;

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar según necesidades de autenticación)
-- Por ahora, permitir todo para usuarios autenticados

DROP POLICY IF EXISTS "Allow all for authenticated users" ON categories;
CREATE POLICY "Allow all for authenticated users" ON categories
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON suppliers;
CREATE POLICY "Allow all for authenticated users" ON suppliers
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON products;
CREATE POLICY "Allow all for authenticated users" ON products
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_movements;
CREATE POLICY "Allow all for authenticated users" ON product_movements
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_price_history;
CREATE POLICY "Allow all for authenticated users" ON product_price_history
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_alerts;
CREATE POLICY "Allow all for authenticated users" ON product_alerts
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- COMENTARIOS EN TABLAS
-- =====================================================

COMMENT ON TABLE categories IS 'Categorías de productos con soporte para jerarquía';
COMMENT ON TABLE suppliers IS 'Proveedores de productos';
COMMENT ON TABLE products IS 'Productos del inventario con precios y stock';
COMMENT ON TABLE product_movements IS 'Historial de movimientos de inventario';
COMMENT ON TABLE product_price_history IS 'Historial de cambios de precios';
COMMENT ON TABLE product_alerts IS 'Alertas y notificaciones de productos';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
