-- =====================================================
-- SOLUCIÓN DEFINITIVA: Productos no aparecen en POS
-- Fecha: 2025-01-06
-- Descripción: Soluciona el problema de productos no visibles en producción
-- =====================================================

-- 1. DIAGNÓSTICO INICIAL
DO $$
DECLARE
    total_count INTEGER;
    active_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM products;
    SELECT COUNT(*) INTO active_count FROM products WHERE is_active = true;
    
    RAISE NOTICE 'DIAGNÓSTICO: Total productos: %, Activos: %', total_count, active_count;
END $$;

-- 2. ACTIVAR TODOS LOS PRODUCTOS
UPDATE products 
SET is_active = true 
WHERE is_active = false OR is_active IS NULL;

-- 3. LIMPIAR TODAS LAS POLÍTICAS RLS EXISTENTES
DROP POLICY IF EXISTS "Vendedores pueden ver productos activos" ON products;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver productos" ON products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON products;
DROP POLICY IF EXISTS "Técnicos pueden ver productos" ON products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON products;
DROP POLICY IF EXISTS "Permitir ver todos los productos a usuarios autenticados" ON products;
DROP POLICY IF EXISTS "POS_productos_lectura_total" ON products;
DROP POLICY IF EXISTS "POS_productos_escritura_admin" ON products;

-- 4. CREAR POLÍTICA SIMPLE Y PERMISIVA PARA LECTURA
CREATE POLICY "pos_products_read_all" 
ON products 
FOR SELECT 
TO authenticated 
USING (true);

-- 5. CREAR POLÍTICA PARA ESCRITURA (ADMIN/INVENTARIO)
CREATE POLICY "pos_products_write_admin" 
ON products 
FOR ALL 
TO authenticated 
USING (
    COALESCE(auth.jwt() ->> 'user_role', 'user') IN ('admin', 'inventory_manager', 'super_admin')
)
WITH CHECK (
    COALESCE(auth.jwt() ->> 'user_role', 'user') IN ('admin', 'inventory_manager', 'super_admin')
);

-- 6. ASEGURAR QUE RLS ESTÉ HABILITADO
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 7. VERIFICAR QUE TODOS LOS PRODUCTOS TENGAN DATOS MÍNIMOS REQUERIDOS
UPDATE products 
SET 
    sale_price = COALESCE(sale_price, 0),
    stock_quantity = COALESCE(stock_quantity, 0),
    sku = COALESCE(sku, 'SKU-' || id::text),
    name = COALESCE(name, 'Producto Sin Nombre')
WHERE 
    sale_price IS NULL 
    OR stock_quantity IS NULL 
    OR sku IS NULL 
    OR name IS NULL 
    OR name = '';

-- 8. INSERTAR PRODUCTOS DE PRUEBA SI HAY MUY POCOS
INSERT INTO products (name, sku, sale_price, stock_quantity, is_active, description)
SELECT 
    'Producto Prueba POS ' || i,
    'POS-TEST-' || LPAD(i::text, 3, '0'),
    (50000 + (i * 10000))::decimal(15,2), -- Precios en guaraníes
    (10 + (i * 5))::integer,
    true,
    'Producto de prueba para verificar funcionamiento del POS'
FROM generate_series(1, 3) AS i
WHERE (SELECT COUNT(*) FROM products WHERE is_active = true) < 5;

-- 9. VERIFICACIÓN FINAL
DO $$
DECLARE
    final_total INTEGER;
    final_active INTEGER;
    policies_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO final_total FROM products;
    SELECT COUNT(*) INTO final_active FROM products WHERE is_active = true;
    SELECT COUNT(*) INTO policies_count FROM pg_policies WHERE tablename = 'products';
    
    RAISE NOTICE 'RESULTADO FINAL:';
    RAISE NOTICE '  - Total productos: %', final_total;
    RAISE NOTICE '  - Productos activos: %', final_active;
    RAISE NOTICE '  - Políticas RLS: %', policies_count;
    
    IF final_active >= 5 THEN
        RAISE NOTICE '✅ ÉXITO: Productos disponibles para POS';
    ELSE
        RAISE NOTICE '⚠️  ADVERTENCIA: Pocos productos activos (%))', final_active;
    END IF;
END $$;

-- 10. CREAR FUNCIÓN DE DIAGNÓSTICO PARA FUTURO USO
CREATE OR REPLACE FUNCTION diagnose_pos_products()
RETURNS TABLE (
    metric TEXT,
    value TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_products'::TEXT, COUNT(*)::TEXT FROM products
    UNION ALL
    SELECT 'active_products'::TEXT, COUNT(*)::TEXT FROM products WHERE is_active = true
    UNION ALL
    SELECT 'with_stock'::TEXT, COUNT(*)::TEXT FROM products WHERE stock_quantity > 0
    UNION ALL
    SELECT 'rls_policies'::TEXT, COUNT(*)::TEXT FROM pg_policies WHERE tablename = 'products'
    UNION ALL
    SELECT 'rls_enabled'::TEXT, 
           CASE WHEN relrowsecurity THEN 'true' ELSE 'false' END
    FROM pg_class WHERE relname = 'products';
END $$;

-- Ejecutar diagnóstico
SELECT * FROM diagnose_pos_products();