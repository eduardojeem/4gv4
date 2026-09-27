-- VERIFICACION SIMPLE: Ver que tablas existen

-- 1. Ver TODAS las tablas en tu base de datos
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Verificar tablas especificas (devuelve true/false)
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') as tiene_categories,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') as tiene_suppliers,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') as tiene_products,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_movements') as tiene_movements,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_price_history') as tiene_price_history,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_alerts') as tiene_alerts;

-- 3. Contar registros (solo si las tablas existen)
-- Si da error, significa que la tabla no existe

-- Intentar contar categories
SELECT 'categories' as tabla, COUNT(*) as registros FROM categories
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'products', COUNT(*) FROM products;

-- 4. Ver columnas de products (si existe)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
ORDER BY ordinal_position;
