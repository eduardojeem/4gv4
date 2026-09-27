-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de categorías de productos
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Color hex para UI
  icon VARCHAR(50) DEFAULT 'Package', -- Icono de Lucide React
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de proveedores
CREATE TABLE suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  tax_id VARCHAR(50), -- RUC o identificación fiscal
  payment_terms INTEGER DEFAULT 30, -- Días de pago
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla principal de productos
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price DECIMAL(10,2) DEFAULT 0 CHECK (purchase_price >= 0),
  sale_price DECIMAL(10,2) DEFAULT 0 CHECK (sale_price >= 0),
  wholesale_price DECIMAL(10,2) DEFAULT 0 CHECK (wholesale_price >= 0),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER DEFAULT 5 CHECK (min_stock >= 0),
  unit_measure VARCHAR(20) DEFAULT 'unidad',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  images TEXT[], -- Array de URLs de imágenes
  barcode VARCHAR(100),
  location VARCHAR(100), -- Ubicación física en almacén
  weight DECIMAL(8,3), -- Peso en kg
  dimensions JSONB, -- {length, width, height} en cm
  warranty_months INTEGER DEFAULT 0,
  is_service BOOLEAN DEFAULT false, -- Si es un servicio en lugar de producto físico
  tags TEXT[], -- Tags para búsqueda
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabla de movimientos de inventario
CREATE TABLE product_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'transfer', 'sale', 'return', 'repair_use')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  reference_type VARCHAR(50), -- 'sale', 'purchase', 'repair', 'adjustment'
  reference_id UUID, -- ID de la venta, compra, reparación, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabla de historial de precios
CREATE TABLE product_price_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_type VARCHAR(20) NOT NULL CHECK (price_type IN ('purchase', 'sale', 'wholesale')),
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabla de alertas de productos
CREATE TABLE product_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'no_supplier', 'no_category', 'no_image', 'inactive_with_sales')),
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_product_movements_product ON product_movements(product_id);
CREATE INDEX idx_product_movements_type ON product_movements(movement_type);
CREATE INDEX idx_product_movements_date ON product_movements(created_at);
CREATE INDEX idx_product_alerts_product ON product_alerts(product_id);
CREATE INDEX idx_product_alerts_type ON product_alerts(alert_type);
CREATE INDEX idx_product_alerts_resolved ON product_alerts(is_resolved);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar movimientos de inventario automáticamente
CREATE OR REPLACE FUNCTION log_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si el stock cambió
    IF OLD.stock IS DISTINCT FROM NEW.stock THEN
        INSERT INTO product_movements (
            product_id,
            movement_type,
            quantity,
            previous_stock,
            new_stock,
            notes,
            created_by
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.stock > OLD.stock THEN 'entry'
                WHEN NEW.stock < OLD.stock THEN 'exit'
                ELSE 'adjustment'
            END,
            ABS(NEW.stock - OLD.stock),
            OLD.stock,
            NEW.stock,
            'Automatic stock update',
            NEW.updated_by
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para movimientos automáticos
CREATE TRIGGER log_product_stock_changes 
    AFTER UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION log_stock_movement();

-- Función para registrar cambios de precios
CREATE OR REPLACE FUNCTION log_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar cambio en precio de compra
    IF OLD.purchase_price IS DISTINCT FROM NEW.purchase_price THEN
        INSERT INTO product_price_history (product_id, price_type, old_price, new_price, created_by)
        VALUES (NEW.id, 'purchase', OLD.purchase_price, NEW.purchase_price, NEW.updated_by);
    END IF;
    
    -- Registrar cambio en precio de venta
    IF OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN
        INSERT INTO product_price_history (product_id, price_type, old_price, new_price, created_by)
        VALUES (NEW.id, 'sale', OLD.sale_price, NEW.sale_price, NEW.updated_by);
    END IF;
    
    -- Registrar cambio en precio mayorista
    IF OLD.wholesale_price IS DISTINCT FROM NEW.wholesale_price THEN
        INSERT INTO product_price_history (product_id, price_type, old_price, new_price, created_by)
        VALUES (NEW.id, 'wholesale', OLD.wholesale_price, NEW.wholesale_price, NEW.updated_by);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para historial de precios
CREATE TRIGGER log_product_price_changes 
    AFTER UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION log_price_changes();

-- Función para generar alertas automáticas
CREATE OR REPLACE FUNCTION check_product_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Limpiar alertas existentes para este producto
    DELETE FROM product_alerts WHERE product_id = NEW.id AND is_resolved = false;
    
    -- Alerta de stock bajo
    IF NEW.stock <= NEW.min_stock AND NEW.stock > 0 THEN
        INSERT INTO product_alerts (product_id, alert_type, message)
        VALUES (NEW.id, 'low_stock', 'Producto con stock bajo: ' || NEW.stock || ' unidades restantes');
    END IF;
    
    -- Alerta de stock agotado
    IF NEW.stock = 0 THEN
        INSERT INTO product_alerts (product_id, alert_type, message)
        VALUES (NEW.id, 'out_of_stock', 'Producto agotado');
    END IF;
    
    -- Alerta de sin proveedor
    IF NEW.supplier_id IS NULL THEN
        INSERT INTO product_alerts (product_id, alert_type, message)
        VALUES (NEW.id, 'no_supplier', 'Producto sin proveedor asignado');
    END IF;
    
    -- Alerta de sin categoría
    IF NEW.category_id IS NULL THEN
        INSERT INTO product_alerts (product_id, alert_type, message)
        VALUES (NEW.id, 'no_category', 'Producto sin categoría asignada');
    END IF;
    
    -- Alerta de sin imagen
    IF NEW.images IS NULL OR array_length(NEW.images, 1) IS NULL THEN
        INSERT INTO product_alerts (product_id, alert_type, message)
        VALUES (NEW.id, 'no_image', 'Producto sin imagen');
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para alertas automáticas
CREATE TRIGGER check_product_alerts_trigger 
    AFTER INSERT OR UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION check_product_alerts();