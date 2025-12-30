-- =====================================================
-- CONFIGURACIÓN COMPLETA PARA POS EN PRODUCCIÓN
-- =====================================================
-- Este script configura todas las tablas necesarias para el sistema POS
-- y elimina dependencias de datos mock

-- 1. VERIFICAR Y CREAR TABLAS PRINCIPALES
-- =====================================================

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Paraguay',
    postal_code VARCHAR(20),
    website VARCHAR(200),
    business_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    products_count INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    category_id UUID REFERENCES public.categories(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    max_stock INTEGER DEFAULT 1000,
    unit_measure VARCHAR(20) DEFAULT 'unidad',
    weight DECIMAL(10,3),
    dimensions VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Paraguay',
    birth_date DATE,
    gender VARCHAR(10),
    document_type VARCHAR(20),
    document_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id),
    total_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
    payment_status VARCHAR(20) DEFAULT 'completed',
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    cashier_id UUID,
    receipt_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de items de venta
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de movimientos de stock
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    movement_type VARCHAR(20) NOT NULL, -- 'sale', 'purchase', 'adjustment', 'return'
    quantity_change INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference VARCHAR(100), -- ID de venta, compra, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para productos
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock_quantity);

-- Índices para ventas
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);

-- Índices para items de venta
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

-- Índices para movimientos de stock
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(created_at);

-- 3. CREAR FUNCIONES PARA GESTIÓN DE STOCK
-- =====================================================

-- Función para actualizar stock de producto
CREATE OR REPLACE FUNCTION public.update_product_stock(
    product_id UUID,
    quantity_change INTEGER,
    movement_type VARCHAR(20),
    reference VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Obtener stock actual
    SELECT stock_quantity INTO current_stock
    FROM public.products
    WHERE id = product_id;
    
    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    
    -- Calcular nuevo stock
    new_stock := current_stock + quantity_change;
    
    -- Validar que el stock no sea negativo
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente. Stock actual: %, Cambio solicitado: %', current_stock, quantity_change;
    END IF;
    
    -- Actualizar stock del producto
    UPDATE public.products
    SET stock_quantity = new_stock,
        updated_at = timezone('utc'::text, now())
    WHERE id = product_id;
    
    -- Registrar movimiento de stock
    INSERT INTO public.stock_movements (
        product_id,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        reference,
        notes
    ) VALUES (
        product_id,
        movement_type,
        quantity_change,
        current_stock,
        new_stock,
        reference,
        notes
    );
    
    RETURN TRUE;
END;
$$;

-- Función para obtener estadísticas de productos
CREATE OR REPLACE FUNCTION public.get_product_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_products', COUNT(*),
        'active_products', COUNT(*) FILTER (WHERE is_active = true),
        'low_stock_products', COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND is_active = true),
        'out_of_stock_products', COUNT(*) FILTER (WHERE stock_quantity = 0 AND is_active = true),
        'total_stock_value', COALESCE(SUM(stock_quantity * cost_price), 0)
    ) INTO result
    FROM public.products;
    
    RETURN result;
END;
$$;

-- 4. CONFIGURAR RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo (ajustar según necesidades de seguridad)
-- NOTA: En producción, estas políticas deberían ser más restrictivas

-- Categorías - lectura pública, escritura autenticada
CREATE POLICY IF NOT EXISTS "categories_read_policy" ON public.categories
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "categories_write_policy" ON public.categories
    FOR ALL USING (auth.role() = 'authenticated');

-- Proveedores - lectura pública, escritura autenticada
CREATE POLICY IF NOT EXISTS "suppliers_read_policy" ON public.suppliers
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "suppliers_write_policy" ON public.suppliers
    FOR ALL USING (auth.role() = 'authenticated');

-- Productos - lectura pública, escritura autenticada
CREATE POLICY IF NOT EXISTS "products_read_policy" ON public.products
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "products_write_policy" ON public.products
    FOR ALL USING (auth.role() = 'authenticated');

-- Clientes - lectura y escritura autenticada
CREATE POLICY IF NOT EXISTS "customers_read_policy" ON public.customers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "customers_write_policy" ON public.customers
    FOR ALL USING (auth.role() = 'authenticated');

-- Ventas - lectura y escritura autenticada
CREATE POLICY IF NOT EXISTS "sales_read_policy" ON public.sales
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "sales_write_policy" ON public.sales
    FOR ALL USING (auth.role() = 'authenticated');

-- Items de venta - lectura y escritura autenticada
CREATE POLICY IF NOT EXISTS "sale_items_read_policy" ON public.sale_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "sale_items_write_policy" ON public.sale_items
    FOR ALL USING (auth.role() = 'authenticated');

-- Movimientos de stock - lectura y escritura autenticada
CREATE POLICY IF NOT EXISTS "stock_movements_read_policy" ON public.stock_movements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "stock_movements_write_policy" ON public.stock_movements
    FOR ALL USING (auth.role() = 'authenticated');

-- 5. TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =====================================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- Triggers para actualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_sales_updated_at
    BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. INSERTAR DATOS INICIALES PARA POS
-- =====================================================

-- Insertar categorías básicas
INSERT INTO public.categories (name, description) VALUES
    ('Smartphones', 'Teléfonos inteligentes y celulares'),
    ('Accesorios', 'Accesorios para dispositivos móviles'),
    ('Electrónicos', 'Dispositivos electrónicos diversos'),
    ('Reparaciones', 'Servicios y repuestos para reparaciones')
ON CONFLICT DO NOTHING;

-- Insertar proveedor por defecto
INSERT INTO public.suppliers (name, contact_person, email, phone, address, city, country) VALUES
    ('Proveedor General', 'Contacto General', 'contacto@proveedor.com', '+595-21-123456', 'Asunción', 'Asunción', 'Paraguay')
ON CONFLICT DO NOTHING;

-- Insertar productos de ejemplo (solo si no existen productos)
DO $$
DECLARE
    cat_smartphones UUID;
    cat_accesorios UUID;
    cat_electronicos UUID;
    supplier_id UUID;
    product_count INTEGER;
BEGIN
    -- Verificar si ya existen productos
    SELECT COUNT(*) INTO product_count FROM public.products;
    
    IF product_count = 0 THEN
        -- Obtener IDs de categorías y proveedor
        SELECT id INTO cat_smartphones FROM public.categories WHERE name = 'Smartphones' LIMIT 1;
        SELECT id INTO cat_accesorios FROM public.categories WHERE name = 'Accesorios' LIMIT 1;
        SELECT id INTO cat_electronicos FROM public.categories WHERE name = 'Electrónicos' LIMIT 1;
        SELECT id INTO supplier_id FROM public.suppliers LIMIT 1;
        
        -- Insertar productos de ejemplo
        INSERT INTO public.products (name, description, sku, barcode, category_id, supplier_id, cost_price, sale_price, stock_quantity, min_stock) VALUES
            ('Samsung Galaxy A54', 'Smartphone con cámara de 50MP y pantalla Super AMOLED', 'SAM-A54-128', '7891234567890', cat_smartphones, supplier_id, 2000000, 2500000, 15, 5),
            ('iPhone 14', 'iPhone 14 con chip A15 Bionic', 'IPH-14-128', '7891234567891', cat_smartphones, supplier_id, 3500000, 4200000, 8, 3),
            ('Auriculares Bluetooth Sony', 'Auriculares inalámbricos con cancelación de ruido', 'SONY-WH1000', '7891234567892', cat_accesorios, supplier_id, 600000, 850000, 12, 5),
            ('Cargador USB-C', 'Cargador rápido USB-C 25W', 'CHAR-USBC-25W', '7891234567893', cat_accesorios, supplier_id, 45000, 75000, 25, 10),
            ('Protector de Pantalla', 'Vidrio templado para smartphones', 'PROT-GLASS', '7891234567894', cat_accesorios, supplier_id, 15000, 35000, 50, 20),
            ('Tablet Samsung Tab A8', 'Tablet Android con pantalla de 10.5 pulgadas', 'SAM-TAB-A8', '7891234567895', cat_electronicos, supplier_id, 1200000, 1650000, 6, 3),
            ('Smartwatch Xiaomi', 'Reloj inteligente con monitor de salud', 'XIA-WATCH-GT3', '7891234567896', cat_electronicos, supplier_id, 350000, 520000, 10, 5),
            ('Power Bank 10000mAh', 'Batería portátil de carga rápida', 'PWR-BANK-10K', '7891234567897', cat_accesorios, supplier_id, 120000, 180000, 18, 8);
    END IF;
END $$;

-- 7. VERIFICACIÓN FINAL
-- =====================================================

-- Mostrar resumen de configuración
DO $$
DECLARE
    table_counts TEXT;
BEGIN
    SELECT string_agg(
        format('%s: %s', table_name, row_count), 
        E'\n'
    ) INTO table_counts
    FROM (
        SELECT 'categories' as table_name, COUNT(*) as row_count FROM public.categories
        UNION ALL
        SELECT 'suppliers', COUNT(*) FROM public.suppliers
        UNION ALL
        SELECT 'products', COUNT(*) FROM public.products
        UNION ALL
        SELECT 'customers', COUNT(*) FROM public.customers
        UNION ALL
        SELECT 'sales', COUNT(*) FROM public.sales
    ) t;
    
    RAISE NOTICE E'=== CONFIGURACIÓN POS COMPLETADA ===\nTablas creadas y datos iniciales:\n%', table_counts;
END $$;

-- Comentario final
COMMENT ON SCHEMA public IS 'Sistema POS configurado para producción - ' || current_timestamp;