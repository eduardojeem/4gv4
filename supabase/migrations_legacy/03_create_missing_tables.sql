-- CREAR SOLO LAS TABLAS FALTANTES
-- Ya tienes: categories, suppliers
-- Faltan: products, product_movements, product_price_history, product_alerts

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLA: products (FALTA)
CREATE TABLE IF NOT EXISTS products (
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

-- Indices para products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- TABLA: product_movements (FALTA)
CREATE TABLE IF NOT EXISTS product_movements (
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

CREATE INDEX IF NOT EXISTS idx_product_movements_product_id ON product_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_created_at ON product_movements(created_at DESC);

-- TABLA: product_price_history (FALTA)
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_type VARCHAR(50) NOT NULL,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  change_reason TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_price_history_product_id ON product_price_history(product_id);

-- TABLA: product_alerts (FALTA)
CREATE TABLE IF NOT EXISTS product_alerts (
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

CREATE INDEX IF NOT EXISTS idx_product_alerts_product_id ON product_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_read ON product_alerts(read);

-- FUNCION: Actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS para updated_at (categories y suppliers ya los tienen, solo products)
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- VISTA: products_full
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
  END as margin_percentage
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id;

-- RLS: Habilitar en las nuevas tablas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;

-- RLS: Politicas
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

-- Mensaje de confirmacion
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TABLAS FALTANTES CREADAS EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas creadas:';
  RAISE NOTICE '  - products';
  RAISE NOTICE '  - product_movements';
  RAISE NOTICE '  - product_price_history';
  RAISE NOTICE '  - product_alerts';
  RAISE NOTICE '';
  RAISE NOTICE 'Siguiente paso:';
  RAISE NOTICE '  Ejecuta: 02_simple_seed.sql';
  RAISE NOTICE '========================================';
END $$;
