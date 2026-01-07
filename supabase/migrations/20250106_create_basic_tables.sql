-- =====================================================
-- CREACIÓN BÁSICA DE TABLAS SIN FOREIGN KEYS COMPLEJAS
-- Fecha: 2025-01-06
-- Descripción: Crea las tablas básicas necesarias para el POS
-- =====================================================

-- 1. CREAR TABLA PRODUCTS (PRINCIPAL PARA POS)
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    description TEXT,
    category_id UUID,  -- Sin FK por ahora
    supplier_id UUID,  -- Sin FK por ahora
    brand TEXT,
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    sale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    barcode VARCHAR(50),
    unit_measure VARCHAR(20) DEFAULT 'unidad',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    weight DECIMAL(10,3),
    dimensions VARCHAR(50),
    image_url TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR TABLA CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID,  -- Self-reference, sin FK por ahora
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREAR TABLA SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Paraguay',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREAR TABLA CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Paraguay',
    document_type VARCHAR(20),
    document_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREAR TABLA SALES (SIN user_id POR AHORA)
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID,  -- Sin FK por ahora
    total_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
    payment_status VARCHAR(20) DEFAULT 'completed',
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CREAR TABLA SALE_ITEMS
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,  -- FK simple a sales
    product_id UUID,        -- Sin FK por ahora
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AGREGAR FOREIGN KEYS SIMPLES (SOLO LAS NECESARIAS)
-- FK de sale_items a sales
ALTER TABLE sale_items 
DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;

ALTER TABLE sale_items 
ADD CONSTRAINT sale_items_sale_id_fkey 
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- 8. CREAR ÍNDICES BÁSICOS
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- 9. HABILITAR RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- 10. CREAR POLÍTICAS RLS PERMISIVAS (PARA QUE FUNCIONE EL POS)
-- Products: todos los usuarios autenticados pueden ver productos
DROP POLICY IF EXISTS "authenticated_users_can_read_products" ON products;
CREATE POLICY "authenticated_users_can_read_products" ON products
    FOR SELECT TO authenticated USING (true);

-- Categories: todos los usuarios autenticados pueden ver categorías
DROP POLICY IF EXISTS "authenticated_users_can_read_categories" ON categories;
CREATE POLICY "authenticated_users_can_read_categories" ON categories
    FOR SELECT TO authenticated USING (true);

-- Customers: todos los usuarios autenticados pueden ver clientes
DROP POLICY IF EXISTS "authenticated_users_can_read_customers" ON customers;
CREATE POLICY "authenticated_users_can_read_customers" ON customers
    FOR SELECT TO authenticated USING (true);

-- Sales: todos los usuarios autenticados pueden ver ventas
DROP POLICY IF EXISTS "authenticated_users_can_read_sales" ON sales;
CREATE POLICY "authenticated_users_can_read_sales" ON sales
    FOR SELECT TO authenticated USING (true);

-- Sale items: todos los usuarios autenticados pueden ver items de venta
DROP POLICY IF EXISTS "authenticated_users_can_read_sale_items" ON sale_items;
CREATE POLICY "authenticated_users_can_read_sale_items" ON sale_items
    FOR SELECT TO authenticated USING (true);

-- 11. INSERTAR DATOS DE PRUEBA SI NO HAY PRODUCTOS
INSERT INTO categories (name, description, is_active)
SELECT 'Electrónicos', 'Productos electrónicos y tecnológicos', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Electrónicos');

INSERT INTO categories (name, description, is_active)
SELECT 'Accesorios', 'Accesorios y complementos', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Accesorios');

-- Insertar productos de prueba si no hay suficientes
DO $$
DECLARE
    electronics_cat_id UUID;
    accessories_cat_id UUID;
BEGIN
    -- Obtener IDs de categorías
    SELECT id INTO electronics_cat_id FROM categories WHERE name = 'Electrónicos' LIMIT 1;
    SELECT id INTO accessories_cat_id FROM categories WHERE name = 'Accesorios' LIMIT 1;
    
    -- Insertar productos solo si hay menos de 5
    IF (SELECT COUNT(*) FROM products) < 5 THEN
        INSERT INTO products (name, sku, description, category_id, sale_price, stock_quantity, is_active)
        VALUES 
        ('iPhone 15 Pro', 'IPH15PRO001', 'iPhone 15 Pro 128GB', electronics_cat_id, 8500000, 10, true),
        ('Samsung Galaxy S24', 'SAM24001', 'Samsung Galaxy S24 256GB', electronics_cat_id, 7200000, 8, true),
        ('Cargador USB-C', 'CHAR001', 'Cargador USB-C 30W', accessories_cat_id, 150000, 25, true),
        ('Funda iPhone', 'FUND001', 'Funda protectora iPhone', accessories_cat_id, 80000, 15, true),
        ('Auriculares Bluetooth', 'AUR001', 'Auriculares inalámbricos', electronics_cat_id, 450000, 12, true);
        
        RAISE NOTICE 'Productos de prueba insertados';
    END IF;
END $$;

-- 12. VERIFICACIÓN FINAL
DO $$
DECLARE
    products_count INTEGER;
    categories_count INTEGER;
    customers_count INTEGER;
    sales_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO products_count FROM products;
    SELECT COUNT(*) INTO categories_count FROM categories;
    SELECT COUNT(*) INTO customers_count FROM customers;
    SELECT COUNT(*) INTO sales_count FROM sales;
    
    RAISE NOTICE '✅ TABLAS CREADAS EXITOSAMENTE:';
    RAISE NOTICE '  - Productos: %', products_count;
    RAISE NOTICE '  - Categorías: %', categories_count;
    RAISE NOTICE '  - Clientes: %', customers_count;
    RAISE NOTICE '  - Ventas: %', sales_count;
    RAISE NOTICE '🎉 POS listo para usar';
END $$;