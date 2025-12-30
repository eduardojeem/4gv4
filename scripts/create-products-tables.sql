-- Script para crear tablas del sistema de gestión de productos
-- Ejecutar en el editor SQL de Supabase

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_id VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla principal de productos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  brand VARCHAR(255),
  supplier_id UUID REFERENCES suppliers(id),
  purchase_price DECIMAL(12,2) DEFAULT 0,
  sale_price DECIMAL(12,2) NOT NULL,
  wholesale_price DECIMAL(12,2),
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit_measure VARCHAR(50) DEFAULT 'unidad',
  barcode VARCHAR(255),
  images TEXT[], -- Array de URLs de imágenes
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS product_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'entrada', 'salida', 'ajuste', 'venta', 'reparacion'
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  unit_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),
  reference_id UUID, -- ID de venta, compra, reparación, etc.
  reference_type VARCHAR(50), -- 'sale', 'purchase', 'repair', 'adjustment'
  notes TEXT,
  user_id UUID, -- Usuario que realizó el movimiento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de historial de precios
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'wholesale'
  old_price DECIMAL(12,2),
  new_price DECIMAL(12,2) NOT NULL,
  change_reason TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de alertas de productos
CREATE TABLE IF NOT EXISTS product_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'no_supplier', 'inactive_with_sales', 'no_image', 'no_category'
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_product_movements_product ON product_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_type ON product_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_product_movements_date ON product_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_product_alerts_product ON product_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_resolved ON product_alerts(is_resolved);

-- Triggers para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar movimientos de inventario automáticamente
CREATE OR REPLACE FUNCTION log_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si cambió el stock
    IF OLD.stock_quantity != NEW.stock_quantity THEN
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
                ELSE 'salida'
            END,
            ABS(NEW.stock_quantity - OLD.stock_quantity),
            OLD.stock_quantity,
            NEW.stock_quantity,
            'Actualización automática de stock'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_product_stock_changes AFTER UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION log_stock_movement();

-- Función para registrar cambios de precios
CREATE OR REPLACE FUNCTION log_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar cambio en precio de compra
    IF OLD.purchase_price != NEW.purchase_price THEN
        INSERT INTO product_price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'purchase', OLD.purchase_price, NEW.purchase_price, 'Actualización de precio de compra');
    END IF;
    
    -- Registrar cambio en precio de venta
    IF OLD.sale_price != NEW.sale_price THEN
        INSERT INTO product_price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'sale', OLD.sale_price, NEW.sale_price, 'Actualización de precio de venta');
    END IF;
    
    -- Registrar cambio en precio mayorista
    IF OLD.wholesale_price != NEW.wholesale_price THEN
        INSERT INTO product_price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'wholesale', OLD.wholesale_price, NEW.wholesale_price, 'Actualización de precio mayorista');
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_product_price_changes AFTER UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION log_price_changes();

-- Políticas RLS (Row Level Security)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir todo para usuarios autenticados)
-- Estas se pueden personalizar según los roles específicos

CREATE POLICY "Enable read access for authenticated users" ON categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON categories
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Enable read access for authenticated users" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON products
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON product_movements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON product_movements
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON product_price_history
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON product_price_history
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON product_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON product_alerts
    FOR ALL USING (auth.role() = 'authenticated');

-- Insertar datos de prueba
INSERT INTO categories (id, name, description) VALUES
    ('electronics', 'Electrónicos', 'Productos electrónicos y tecnológicos'),
    ('accessories', 'Accesorios', 'Accesorios para dispositivos'),
    ('repairs', 'Repuestos', 'Repuestos para reparaciones')
ON CONFLICT (id) DO NOTHING;

INSERT INTO suppliers (id, name, contact_name, email, phone) VALUES
    (gen_random_uuid(), 'TechDistributor', 'Juan Pérez', 'juan@techdist.com', '+57 300 123 4567'),
    (gen_random_uuid(), 'ElectroSupply', 'María García', 'maria@electro.com', '+57 301 234 5678'),
    (gen_random_uuid(), 'ComponentesPro', 'Carlos López', 'carlos@componentes.com', '+57 302 345 6789');
