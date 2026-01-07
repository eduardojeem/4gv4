-- =====================================================
-- CORRECCIÓN: Unificar columnas de stock
-- Fecha: 2025-01-06
-- Descripción: Soluciona inconsistencias entre 'stock' y 'stock_quantity'
-- =====================================================

-- 1. DIAGNÓSTICO: Verificar qué columnas existen
DO $$
DECLARE
    has_stock BOOLEAN;
    has_stock_quantity BOOLEAN;
BEGIN
    -- Verificar si existe columna 'stock'
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
          AND column_name = 'stock'
          AND table_schema = 'public'
    ) INTO has_stock;
    
    -- Verificar si existe columna 'stock_quantity'
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
          AND column_name = 'stock_quantity'
          AND table_schema = 'public'
    ) INTO has_stock_quantity;
    
    RAISE NOTICE 'DIAGNÓSTICO COLUMNAS DE STOCK:';
    RAISE NOTICE '  - Columna "stock": %', CASE WHEN has_stock THEN 'EXISTE' ELSE 'NO EXISTE' END;
    RAISE NOTICE '  - Columna "stock_quantity": %', CASE WHEN has_stock_quantity THEN 'EXISTE' ELSE 'NO EXISTE' END;
END $$;

-- 2. AGREGAR COLUMNA stock_quantity SI NO EXISTE
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- 3. MIGRAR DATOS DE 'stock' A 'stock_quantity' SI AMBAS EXISTEN
DO $$
DECLARE
    has_stock BOOLEAN;
    has_stock_quantity BOOLEAN;
    record_count INTEGER;
BEGIN
    -- Verificar existencia de columnas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock' AND table_schema = 'public'
    ) INTO has_stock;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_quantity' AND table_schema = 'public'
    ) INTO has_stock_quantity;
    
    -- Si ambas existen, migrar datos
    IF has_stock AND has_stock_quantity THEN
        -- Migrar datos donde stock_quantity es 0 pero stock tiene valor
        UPDATE products 
        SET stock_quantity = stock 
        WHERE stock_quantity = 0 AND stock > 0;
        
        GET DIAGNOSTICS record_count = ROW_COUNT;
        RAISE NOTICE 'Migrados % registros de "stock" a "stock_quantity"', record_count;
        
        -- También migrar en la dirección opuesta si es necesario
        UPDATE products 
        SET stock = stock_quantity 
        WHERE stock = 0 AND stock_quantity > 0;
        
        GET DIAGNOSTICS record_count = ROW_COUNT;
        RAISE NOTICE 'Migrados % registros de "stock_quantity" a "stock"', record_count;
    END IF;
END $$;

-- 4. ASEGURAR QUE AMBAS COLUMNAS TENGAN LOS MISMOS VALORES
DO $$
DECLARE
    has_stock BOOLEAN;
    has_stock_quantity BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock' AND table_schema = 'public'
    ) INTO has_stock;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_quantity' AND table_schema = 'public'
    ) INTO has_stock_quantity;
    
    IF has_stock AND has_stock_quantity THEN
        -- Sincronizar: usar el valor mayor entre ambas columnas
        UPDATE products 
        SET 
            stock_quantity = GREATEST(COALESCE(stock, 0), COALESCE(stock_quantity, 0)),
            stock = GREATEST(COALESCE(stock, 0), COALESCE(stock_quantity, 0));
        
        RAISE NOTICE 'Columnas "stock" y "stock_quantity" sincronizadas';
    END IF;
END $$;

-- 5. AGREGAR OTRAS COLUMNAS NECESARIAS SI NO EXISTEN
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_measure VARCHAR(20) DEFAULT 'unidad';

-- 6. CORREGIR ÍNDICES DUPLICADOS
DROP INDEX IF EXISTS idx_products_stock;
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- 7. CREAR TRIGGER PARA MANTENER SINCRONIZADAS AMBAS COLUMNAS
CREATE OR REPLACE FUNCTION sync_stock_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se actualiza stock_quantity, sincronizar stock
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
        NEW.stock = NEW.stock_quantity;
    END IF;
    
    -- Si se actualiza stock, sincronizar stock_quantity
    IF NEW.stock IS DISTINCT FROM OLD.stock THEN
        NEW.stock_quantity = NEW.stock;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger solo si ambas columnas existen
DO $$
DECLARE
    has_stock BOOLEAN;
    has_stock_quantity BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock' AND table_schema = 'public'
    ) INTO has_stock;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_quantity' AND table_schema = 'public'
    ) INTO has_stock_quantity;
    
    IF has_stock AND has_stock_quantity THEN
        DROP TRIGGER IF EXISTS sync_stock_trigger ON products;
        CREATE TRIGGER sync_stock_trigger
            BEFORE UPDATE ON products
            FOR EACH ROW
            EXECUTE FUNCTION sync_stock_columns();
        
        RAISE NOTICE 'Trigger de sincronización de stock creado';
    END IF;
END $$;

-- 8. VERIFICACIÓN FINAL
DO $$
DECLARE
    total_products INTEGER;
    products_with_stock INTEGER;
    products_active INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_products FROM products;
    SELECT COUNT(*) INTO products_with_stock FROM products WHERE stock_quantity > 0;
    SELECT COUNT(*) INTO products_active FROM products WHERE is_active = true;
    
    RAISE NOTICE 'VERIFICACIÓN FINAL:';
    RAISE NOTICE '  - Total productos: %', total_products;
    RAISE NOTICE '  - Productos con stock: %', products_with_stock;
    RAISE NOTICE '  - Productos activos: %', products_active;
END $$;