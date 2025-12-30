-- =====================================================
-- SCRIPT COMPLETO: Sistema de Productos
-- Fecha: 2024-12-06
-- Descripción: Crea estructura Y datos en un solo script
-- =====================================================

-- =====================================================
-- PARTE 1: LIMPIEZA (Opcional - comentar si no necesitas)
-- =====================================================

-- Desactivar RLS temporalmente
ALTER TABLE IF EXISTS product_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_price_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas
DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_alerts;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_price_history;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_movements;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON suppliers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON categories;

-- Eliminar vistas
DROP VIEW IF EXISTS products_full CASCADE;
DROP VIEW IF EXISTS product_stats CASCADE;

-- Eliminar triggers
DROP TRIGGER IF EXISTS check_product_stock ON products;
DROP TRIGGER IF EXISTS auto_create_stock_movement ON products;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;

-- Eliminar funciones
DROP FUNCTION IF EXISTS check_low_stock() CASCADE;
DROP FUNCTION IF EXISTS create_stock_movement() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS product_alerts CASCADE;
DROP TABLE IF EXISTS product_price_history CASCADE;
DROP TABLE IF EXISTS product_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- =====================================================
-- PARTE 2: CREAR ESTRUCTURA
-- =====================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla: categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: suppliers
CREATE TABLE suppliers (
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

-- Tabla: products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price DECIMAL(10, 2) DEFAULT 0,
  sale_price DECIMAL(10, 2) NOT NULL,
  wholesale_price DECIMAL(10, 2),
  offer_price DECIMAL(10, 2),
  has_offer BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER,
  unit_measure VARCHAR(50) DEFAULT 'unidad',
  barcode VARCHAR(50),
  images TEXT[],
  image_url TEXT,
  weight DECIMAL(10, 2),
  dimensions VARCHAR(100),
  location VARCHAR(100),
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: product_movements
CREATE TABLE product_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  reference_id UUID,
  reference_type VARCHAR(50),
  notes TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: product_price_history
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_type VARCHAR(50) NOT NULL,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  change_reason TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: product_alerts
CREATE TABLE product_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PARTE 3: CREAR ÍNDICES
-- =====================================================

-- Índices categories
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);
CREATE INDEX idx_categories_name ON categories(name);

-- Índices suppliers
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_email ON suppliers(email);

-- Índices products
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, '')));

-- Índices product_movements
CREATE INDEX idx_product_movements_product_id ON product_movements(product_id);
CREATE INDEX idx_product_movements_movement_type ON product_movements(movement_type);
CREATE INDEX idx_product_movements_created_at ON product_movements(created_at DESC);
CREATE INDEX idx_product_movements_reference ON product_movements(reference_id, reference_type);

-- Índices product_price_history
CREATE INDEX idx_product_price_history_product_id ON product_price_history(product_id);
CREATE INDEX idx_product_price_history_price_type ON product_price_history(price_type);
CREATE INDEX idx_product_price_history_created_at ON product_price_history(created_at DESC);

-- Índices product_alerts
CREATE INDEX idx_product_alerts_product_id ON product_alerts(product_id);
CREATE INDEX idx_product_alerts_type ON product_alerts(type);
CREATE INDEX idx_product_alerts_read ON product_alerts(read);
CREATE INDEX idx_product_alerts_is_resolved ON product_alerts(is_resolved);
CREATE INDEX idx_product_alerts_created_at ON product_alerts(created_at DESC);

-- =====================================================
-- PARTE 4: CREAR FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para movimientos de stock
CREATE OR REPLACE FUNCTION create_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity THEN
    INSERT INTO product_movements (
      product_id, movement_type, quantity, previous_stock, new_stock, notes
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

-- Función para alertas de stock
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_quantity <= NEW.min_stock AND NEW.stock_quantity > 0 THEN
    INSERT INTO product_alerts (product_id, type, message, details)
    VALUES (
      NEW.id, 'low_stock', 'Stock bajo: ' || NEW.name,
      jsonb_build_object('current_stock', NEW.stock_quantity, 'min_stock', NEW.min_stock, 'product_name', NEW.name)
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  IF NEW.stock_quantity = 0 THEN
    INSERT INTO product_alerts (product_id, type, message, details)
    VALUES (
      NEW.id, 'out_of_stock', 'Stock agotado: ' || NEW.name,
      jsonb_build_object('product_name', NEW.name)
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auto_create_stock_movement AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION create_stock_movement();

CREATE TRIGGER check_product_stock AFTER INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION check_low_stock();

-- =====================================================
-- PARTE 5: CREAR VISTAS
-- =====================================================

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
-- PARTE 6: CONFIGURAR RLS
-- =====================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON categories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON suppliers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON product_movements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON product_price_history
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON product_alerts
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- PARTE 7: INSERTAR DATOS DE EJEMPLO
-- =====================================================

-- Categorías
INSERT INTO categories (id, name, description, parent_id, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Electrónica', 'Productos electrónicos y tecnología', NULL, true),
('22222222-2222-2222-2222-222222222222', 'Ropa y Accesorios', 'Prendas de vestir y complementos', NULL, true),
('33333333-3333-3333-3333-333333333333', 'Hogar y Jardín', 'Artículos para el hogar y jardín', NULL, true),
('44444444-4444-4444-4444-444444444444', 'Deportes', 'Artículos deportivos y fitness', NULL, true),
('55555555-5555-5555-5555-555555555555', 'Alimentos y Bebidas', 'Productos alimenticios', NULL, true),
('11111111-1111-1111-1111-111111111112', 'Smartphones', 'Teléfonos inteligentes', '11111111-1111-1111-1111-111111111111', true),
('11111111-1111-1111-1111-111111111113', 'Laptops', 'Computadoras portátiles', '11111111-1111-1111-1111-111111111111', true),
('11111111-1111-1111-1111-111111111114', 'Accesorios Tech', 'Accesorios para dispositivos', '11111111-1111-1111-1111-111111111111', true),
('22222222-2222-2222-2222-222222222223', 'Camisetas', 'Camisetas y playeras', '22222222-2222-2222-2222-222222222222', true),
('22222222-2222-2222-2222-222222222224', 'Pantalones', 'Pantalones y jeans', '22222222-2222-2222-2222-222222222222', true),
('22222222-2222-2222-2222-222222222225', 'Calzado', 'Zapatos y tenis', '22222222-2222-2222-2222-222222222222', true);

-- Proveedores
INSERT INTO suppliers (id, name, contact_name, email, phone, address, tax_id, is_active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Distributors SA', 'Juan Pérez', 'contacto@techdist.com', '+52 55 1234 5678', 'Av. Reforma 123, CDMX', 'TDS123456ABC', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fashion Import Co', 'María García', 'ventas@fashionimport.com', '+52 55 8765 4321', 'Calle Moda 456, Guadalajara', 'FIC789012DEF', true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Home & Garden Supplies', 'Carlos López', 'info@homegardens.com', '+52 81 2345 6789', 'Blvd. Hogar 789, Monterrey', 'HGS345678GHI', true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Sports Pro México', 'Ana Martínez', 'contacto@sportspro.mx', '+52 33 9876 5432', 'Av. Deportes 321, Puebla', 'SPM901234JKL', true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Alimentos del Valle', 'Roberto Sánchez', 'ventas@alimentosvalle.com', '+52 55 5555 5555', 'Calle Alimentos 654, CDMX', 'ADV567890MNO', true);

-- Productos (solo algunos ejemplos para mantener el script corto)
INSERT INTO products (
  id, sku, name, description, category_id, brand, supplier_id,
  purchase_price, sale_price, wholesale_price, offer_price, has_offer,
  stock_quantity, min_stock, max_stock, unit_measure, barcode,
  images, weight, dimensions, location, tags, is_active, featured
) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'IPHONE-14-PRO-128',
  'iPhone 14 Pro 128GB',
  'iPhone 14 Pro con pantalla Super Retina XDR de 6.1 pulgadas',
  '11111111-1111-1111-1111-111111111112',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  18000.00, 24999.00, 23500.00, NULL, false,
  15, 5, 50, 'unidad', '7501234567890',
  ARRAY['https://images.unsplash.com/photo-1678652197950-1c6c5b0d3d8d?w=800'],
  0.206, '14.7 x 7.15 x 0.78 cm', 'Estante A1', ARRAY['smartphone', 'apple', 'premium'], true, true
),
(
  '10000000-0000-0000-0000-000000000002',
  'SAMSUNG-S23-256',
  'Samsung Galaxy S23 256GB',
  'Samsung Galaxy S23 con pantalla Dynamic AMOLED 2X de 6.1"',
  '11111111-1111-1111-1111-111111111112',
  'Samsung',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  14000.00, 19999.00, 18500.00, 17999.00, true,
  22, 5, 40, 'unidad', '7501234567891',
  ARRAY['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800'],
  0.168, '14.6 x 7.06 x 0.76 cm', 'Estante A1', ARRAY['smartphone', 'samsung', 'android'], true, true
);

-- =====================================================
-- PARTE 8: VERIFICACIÓN
-- =====================================================

DO $$
DECLARE
  tables_count INTEGER;
  products_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts');
  
  SELECT COUNT(*) INTO products_count FROM products;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INSTALACIÓN COMPLETADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas creadas: %', tables_count;
  RAISE NOTICE 'Productos insertados: %', products_count;
  RAISE NOTICE '';
  
  IF tables_count = 6 AND products_count > 0 THEN
    RAISE NOTICE '✓✓✓ ÉXITO ✓✓✓';
    RAISE NOTICE 'El sistema está listo para usar';
  ELSE
    RAISE NOTICE '⚠ Advertencia: Verifica la instalación';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN DEL SCRIPT COMPLETO
-- =====================================================
