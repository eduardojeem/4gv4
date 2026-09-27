-- =====================================================
-- CORRECCIÓN: Referencias a user_id faltantes
-- Fecha: 2025-01-06
-- Descripción: Soluciona problemas con columnas user_id faltantes
-- =====================================================

-- 1. DIAGNÓSTICO: Verificar qué tablas y columnas existen
DO $$
DECLARE
    profiles_exists BOOLEAN;
    sales_exists BOOLEAN;
    sales_has_user_id BOOLEAN;
BEGIN
    -- Verificar si existe tabla profiles
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'profiles' AND table_schema = 'public'
    ) INTO profiles_exists;
    
    -- Verificar si existe tabla sales
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'sales' AND table_schema = 'public'
    ) INTO sales_exists;
    
    -- Verificar si sales tiene columna user_id
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' 
          AND column_name = 'user_id'
          AND table_schema = 'public'
    ) INTO sales_has_user_id;
    
    RAISE NOTICE 'DIAGNÓSTICO TABLAS:';
    RAISE NOTICE '  - Tabla "profiles": %', CASE WHEN profiles_exists THEN 'EXISTE' ELSE 'NO EXISTE' END;
    RAISE NOTICE '  - Tabla "sales": %', CASE WHEN sales_exists THEN 'EXISTE' ELSE 'NO EXISTE' END;
    RAISE NOTICE '  - Columna "sales.user_id": %', CASE WHEN sales_has_user_id THEN 'EXISTE' ELSE 'NO EXISTE' END;
END $$;

-- 2. CREAR TABLA PROFILES SI NO EXISTE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREAR TABLA SALES SI NO EXISTE (sin user_id primero)
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID,  -- Referencia temporal sin FK
    total DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. AGREGAR COLUMNA user_id A SALES SI NO EXISTE
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id UUID;

-- 5. CREAR FOREIGN KEY CONSTRAINTS DESPUÉS DE QUE AMBAS TABLAS EXISTAN
DO $$
DECLARE
    profiles_exists BOOLEAN;
    customers_exists BOOLEAN;
BEGIN
    -- Verificar existencia de tablas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'profiles' AND table_schema = 'public'
    ) INTO profiles_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'customers' AND table_schema = 'public'
    ) INTO customers_exists;
    
    -- Agregar FK a profiles si existe
    IF profiles_exists THEN
        -- Eliminar constraint existente si existe
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
        
        -- Agregar nueva constraint
        ALTER TABLE sales 
        ADD CONSTRAINT sales_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key sales.user_id -> profiles.id creada';
    END IF;
    
    -- Agregar FK a customers si existe
    IF customers_exists THEN
        -- Eliminar constraint existente si existe
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;
        
        -- Agregar nueva constraint
        ALTER TABLE sales 
        ADD CONSTRAINT sales_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key sales.customer_id -> customers.id creada';
    END IF;
END $$;

-- 6. CREAR TABLA CUSTOMERS SI NO EXISTE
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Paraguay',
    document_type TEXT,
    document_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AGREGAR OTRAS COLUMNAS NECESARIAS A SALES
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0;

-- 8. SINCRONIZAR COLUMNAS DE SALES (por compatibilidad)
DO $$
BEGIN
    -- Sincronizar total con total_amount
    UPDATE sales 
    SET total_amount = total 
    WHERE total_amount IS NULL AND total IS NOT NULL;
    
    UPDATE sales 
    SET total = total_amount 
    WHERE total IS NULL AND total_amount IS NOT NULL;
    
    -- Sincronizar tax con tax_amount
    UPDATE sales 
    SET tax_amount = tax 
    WHERE tax_amount IS NULL AND tax IS NOT NULL;
    
    UPDATE sales 
    SET tax = tax_amount 
    WHERE tax IS NULL AND tax_amount IS NOT NULL;
    
    -- Sincronizar discount con discount_amount
    UPDATE sales 
    SET discount_amount = discount 
    WHERE discount_amount IS NULL AND discount IS NOT NULL;
    
    UPDATE sales 
    SET discount = discount_amount 
    WHERE discount IS NULL AND discount_amount IS NOT NULL;
    
    RAISE NOTICE 'Columnas de sales sincronizadas';
END $$;

-- 9. CREAR TABLA SALE_ITEMS SI NO EXISTE
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID,  -- Referencia temporal
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. CREAR ÍNDICES NECESARIOS
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- 11. HABILITAR RLS EN TABLAS PRINCIPALES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 12. CREAR POLÍTICAS RLS BÁSICAS
-- Profiles: usuarios pueden ver su propio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Sales: usuarios pueden ver sus propias ventas
DROP POLICY IF EXISTS "Users can view own sales" ON sales;
CREATE POLICY "Users can view own sales" ON sales
    FOR SELECT USING (
        user_id = auth.uid() OR 
        auth.uid() IN (
            SELECT id FROM profiles WHERE role IN ('admin', 'manager')
        )
    );

-- Customers: usuarios autenticados pueden ver clientes
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
CREATE POLICY "Authenticated users can view customers" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

-- 13. VERIFICACIÓN FINAL
DO $$
DECLARE
    profiles_count INTEGER;
    sales_count INTEGER;
    customers_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profiles_count FROM profiles;
    SELECT COUNT(*) INTO sales_count FROM sales;
    SELECT COUNT(*) INTO customers_count FROM customers;
    
    RAISE NOTICE 'VERIFICACIÓN FINAL:';
    RAISE NOTICE '  - Profiles: %', profiles_count;
    RAISE NOTICE '  - Sales: %', sales_count;
    RAISE NOTICE '  - Customers: %', customers_count;
    RAISE NOTICE '✅ Migración completada exitosamente';
END $$;