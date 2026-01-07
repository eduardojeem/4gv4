-- =====================================================
-- VERIFICAR SCHEMA ACTUAL DE LA TABLA PRODUCTS
-- =====================================================

-- 1. Verificar qué columnas existen en la tabla products
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si existe la columna 'stock'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' 
              AND column_name = 'stock'
              AND table_schema = 'public'
        ) THEN 'La columna "stock" EXISTE'
        ELSE 'La columna "stock" NO EXISTE'
    END as stock_column_status;

-- 3. Verificar si existe la columna 'stock_quantity'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' 
              AND column_name = 'stock_quantity'
              AND table_schema = 'public'
        ) THEN 'La columna "stock_quantity" EXISTE'
        ELSE 'La columna "stock_quantity" NO EXISTE'
    END as stock_quantity_column_status;

-- 4. Mostrar algunos productos de ejemplo para ver qué datos hay
SELECT 
    id, 
    name, 
    sku,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' 
              AND column_name = 'stock'
              AND table_schema = 'public'
        ) THEN 'Columna stock existe'
        ELSE 'Columna stock NO existe'
    END as stock_info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' 
              AND column_name = 'stock_quantity'
              AND table_schema = 'public'
        ) THEN 'Columna stock_quantity existe'
        ELSE 'Columna stock_quantity NO existe'
    END as stock_quantity_info
FROM products 
LIMIT 3;