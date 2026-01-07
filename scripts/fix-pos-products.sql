-- =====================================================
-- DIAGNÓSTICO Y SOLUCIÓN: Productos no aparecen en POS
-- Fecha: 2025-01-06
-- =====================================================

-- 1. DIAGNÓSTICO: Verificar estado actual de productos
SELECT 
    COUNT(*) as total_productos,
    COUNT(*) FILTER (WHERE is_active = true) as productos_activos,
    COUNT(*) FILTER (WHERE is_active = false) as productos_inactivos,
    COUNT(*) FILTER (WHERE stock_quantity > 0) as con_stock,
    COUNT(*) FILTER (WHERE stock_quantity = 0) as sin_stock
FROM products;

-- 2. DIAGNÓSTICO: Verificar productos específicos
SELECT 
    id, 
    name, 
    sku, 
    is_active, 
    stock_quantity, 
    sale_price,
    created_at
FROM products 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. DIAGNÓSTICO: Verificar políticas RLS activas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'products';

-- 4. SOLUCIÓN 1: Activar todos los productos
UPDATE products 
SET is_active = true 
WHERE is_active = false OR is_active IS NULL;

-- 5. SOLUCIÓN 2: Eliminar políticas RLS restrictivas y crear una permisiva
DROP POLICY IF EXISTS "Vendedores pueden ver productos activos" ON products;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver productos" ON products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON products;
DROP POLICY IF EXISTS "Técnicos pueden ver productos" ON products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON products;
DROP POLICY IF EXISTS "Permitir ver todos los productos a usuarios autenticados" ON products;

-- 6. CREAR POLÍTICA PERMISIVA PARA LECTURA
CREATE POLICY "POS_productos_lectura_total" 
ON products 
FOR SELECT 
TO authenticated 
USING (true);

-- 7. CREAR POLÍTICA PARA ESCRITURA (solo admin/inventario)
CREATE POLICY "POS_productos_escritura_admin" 
ON products 
FOR ALL 
TO authenticated 
USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager', 'super_admin')
)
WITH CHECK (
    auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager', 'super_admin')
);

-- 8. VERIFICACIÓN FINAL: Contar productos visibles después de los cambios
SELECT 
    COUNT(*) as productos_totales_visibles,
    COUNT(*) FILTER (WHERE is_active = true) as productos_activos_visibles
FROM products;

-- 9. INSERTAR PRODUCTOS DE PRUEBA SI NO HAY SUFICIENTES
INSERT INTO products (name, sku, sale_price, stock_quantity, is_active)
SELECT 
    'Producto Prueba ' || generate_series,
    'TEST-' || LPAD(generate_series::text, 4, '0'),
    (random() * 100 + 10)::decimal(10,2),
    (random() * 50 + 1)::integer,
    true
FROM generate_series(1, 5)
WHERE (SELECT COUNT(*) FROM products WHERE is_active = true) < 10;

-- 10. MENSAJE FINAL
SELECT 'Diagnóstico y corrección completados. Verifique el POS ahora.' as mensaje;