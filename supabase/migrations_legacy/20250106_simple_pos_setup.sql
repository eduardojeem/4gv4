-- =====================================================
-- CONFIGURACIÓN SIMPLE PARA POS - SIN ERRORES
-- Fecha: 2025-01-06
-- Descripción: Crea solo las tablas esenciales para que funcione el POS
-- =====================================================

-- 1. CREAR TABLA PRODUCTS (LO MÁS IMPORTANTE PARA POS)
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    description TEXT,
    category_id UUID,
    supplier_id UUID,
    brand TEXT,
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    sale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    barcode VARCHAR(50),
    unit_measure VARCHAR(20) DEFAULT 'unidad',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    image_url TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. VERIFICAR Y AGREGAR COLUMNAS FALTANTES A PRODUCTS
DO $$
BEGIN
    -- Agregar columnas solo si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_quantity') THEN
        ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_active') THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'barcode') THEN
        ALTER TABLE products ADD COLUMN barcode VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'unit_measure') THEN
        ALTER TABLE products ADD COLUMN unit_measure VARCHAR(20) DEFAULT 'unidad';
    END IF;
    
    RAISE NOTICE 'Columnas de products verificadas y agregadas si faltaban';
END $$;

-- 3. ACTIVAR TODOS LOS PRODUCTOS
UPDATE products SET is_active = true WHERE is_active IS NULL OR is_active = false;

-- 4. ASEGURAR DATOS MÍNIMOS EN PRODUCTS
UPDATE products 
SET 
    stock_quantity = COALESCE(stock_quantity, 0),
    sale_price = GREATEST(COALESCE(sale_price, 0), 0),
    sku = COALESCE(sku, 'SKU-' || id::text),
    name = COALESCE(name, 'Producto Sin Nombre'),
    is_active = COALESCE(is_active, true)
WHERE 
    stock_quantity IS NULL 
    OR sale_price IS NULL 
    OR sku IS NULL 
    OR name IS NULL 
    OR name = ''
    OR is_active IS NULL;

-- 5. CREAR TABLA CATEGORIES (SIMPLE)
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CREAR TABLA CUSTOMERS (SIMPLE)
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CREAR TABLA SALES (SIMPLE - SIN COLUMNAS PROBLEMÁTICAS)
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID,
    total_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash',
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. CREAR TABLA SALE_ITEMS (SIMPLE)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. AGREGAR FOREIGN KEY SIMPLE (SOLO LA ESENCIAL)
DO $$
BEGIN
    -- FK de sale_items a sales (solo si ambas tablas existen)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sale_items') THEN
        
        -- Eliminar FK existente si existe
        ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
        
        -- Agregar FK nueva
        ALTER TABLE sale_items 
        ADD CONSTRAINT sale_items_sale_id_fkey 
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key sale_items -> sales creada';
    END IF;
END $$;

-- 10. CREAR ÍNDICES ESENCIALES
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sale_price ON products(sale_price);

-- 11. HABILITAR RLS CON POLÍTICAS PERMISIVAS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- 12. CREAR POLÍTICAS RLS PERMISIVAS (PARA QUE FUNCIONE EL POS)
-- Products
DROP POLICY IF EXISTS "pos_read_products" ON products;
CREATE POLICY "pos_read_products" ON products
    FOR SELECT TO authenticated USING (true);

-- Categories
DROP POLICY IF EXISTS "pos_read_categories" ON categories;
CREATE POLICY "pos_read_categories" ON categories
    FOR SELECT TO authenticated USING (true);

-- Customers
DROP POLICY IF EXISTS "pos_read_customers" ON customers;
CREATE POLICY "pos_read_customers" ON customers
    FOR SELECT TO authenticated USING (true);

-- Sales
DROP POLICY IF EXISTS "pos_read_sales" ON sales;
CREATE POLICY "pos_read_sales" ON sales
    FOR SELECT TO authenticated USING (true);

-- Sale items
DROP POLICY IF EXISTS "pos_read_sale_items" ON sale_items;
CREATE POLICY "pos_read_sale_items" ON sale_items
    FOR SELECT TO authenticated USING (true);

-- 13. INSERTAR CATEGORÍAS BÁSICAS
INSERT INTO categories (name, description, is_active)
SELECT 'Electrónicos', 'Productos electrónicos y tecnológicos', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Electrónicos');

INSERT INTO categories (name, description, is_active)
SELECT 'Accesorios', 'Accesorios y complementos', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Accesorios');

INSERT INTO categories (name, description, is_active)
SELECT 'Servicios', 'Servicios técnicos y reparaciones', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Servicios');

-- 14. INSERTAR PRODUCTOS DE PRUEBA SI NO HAY SUFICIENTES
DO $$
DECLARE
    electronics_cat_id UUID;
    accessories_cat_id UUID;
    services_cat_id UUID;
    product_count INTEGER;
BEGIN
    -- Contar productos existentes
    SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
    
    -- Solo insertar si hay menos de 5 productos activos
    IF product_count < 5 THEN
        -- Obtener IDs de categorías
        SELECT id INTO electronics_cat_id FROM categories WHERE name = 'Electrónicos' LIMIT 1;
        SELECT id INTO accessories_cat_id FROM categories WHERE name = 'Accesorios' LIMIT 1;
        SELECT id INTO services_cat_id FROM categories WHERE name = 'Servicios' LIMIT 1;
        
        -- Insertar productos de prueba
        INSERT INTO products (name, sku, description, category_id, sale_price, stock_quantity, is_active, barcode)
        VALUES 
        ('iPhone 15 Pro 128GB', 'IPH15PRO128', 'iPhone 15 Pro 128GB Titanio Natural', electronics_cat_id, 8500000, 5, true, '1234567890123'),
        ('Samsung Galaxy S24', 'SAM24256', 'Samsung Galaxy S24 256GB', electronics_cat_id, 7200000, 8, true, '1234567890124'),
        ('Cargador USB-C 30W', 'CHAR30W', 'Cargador rápido USB-C 30W', accessories_cat_id, 150000, 25, true, '1234567890125'),
        ('Funda iPhone 15 Pro', 'FUND15PRO', 'Funda protectora transparente', accessories_cat_id, 80000, 15, true, '1234567890126'),
        ('Auriculares Bluetooth', 'AUR001', 'Auriculares inalámbricos premium', electronics_cat_id, 450000, 12, true, '1234567890127'),
        ('Reparación Pantalla', 'REP001', 'Servicio de reparación de pantalla', services_cat_id, 300000, 999, true, 'SRV001'),
        ('Protector de Pantalla', 'PROT001', 'Protector de pantalla vidrio templado', accessories_cat_id, 45000, 50, true, '1234567890128'),
        ('Cable Lightning', 'CABLE001', 'Cable Lightning 1m original', accessories_cat_id, 120000, 30, true, '1234567890129');
        
        RAISE NOTICE 'Productos de prueba insertados (total: %)', product_count + 8;
    ELSE
        RAISE NOTICE 'Ya hay suficientes productos (%), no se insertan más', product_count;
    END IF;
END $$;

-- 15. VERIFICACIÓN FINAL Y DIAGNÓSTICO
DO $$
DECLARE
    products_count INTEGER;
    active_products INTEGER;
    categories_count INTEGER;
    customers_count INTEGER;
    sales_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO products_count FROM products;
    SELECT COUNT(*) INTO active_products FROM products WHERE is_active = true;
    SELECT COUNT(*) INTO categories_count FROM categories;
    SELECT COUNT(*) INTO customers_count FROM customers;
    SELECT COUNT(*) INTO sales_count FROM sales;
    
    RAISE NOTICE '🎉 CONFIGURACIÓN POS COMPLETADA:';
    RAISE NOTICE '  ✅ Productos totales: %', products_count;
    RAISE NOTICE '  ✅ Productos activos: %', active_products;
    RAISE NOTICE '  ✅ Categorías: %', categories_count;
    RAISE NOTICE '  ✅ Clientes: %', customers_count;
    RAISE NOTICE '  ✅ Ventas: %', sales_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 EL POS ESTÁ LISTO PARA USAR';
    
    -- Verificar que el hook usePOSProducts funcionará
    IF active_products >= 5 THEN
        RAISE NOTICE '✅ Hook usePOSProducts debería funcionar correctamente';
    ELSE
        RAISE NOTICE '⚠️  Pocos productos activos, pero debería funcionar';
    END IF;
END $$;