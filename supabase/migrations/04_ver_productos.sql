-- =====================================================
-- VER PRODUCTOS CREADOS
-- Ejecuta este script para ver todos los productos
-- =====================================================

-- 1. RESUMEN GENERAL
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'RESUMEN DE PRODUCTOS'
UNION ALL
SELECT '========================================';

SELECT 
  COUNT(*) as total_productos,
  COUNT(*) FILTER (WHERE is_active = true) as productos_activos,
  COUNT(*) FILTER (WHERE featured = true) as productos_destacados,
  COUNT(*) FILTER (WHERE has_offer = true) as productos_en_oferta,
  COUNT(*) FILTER (WHERE stock_quantity <= min_stock) as stock_bajo,
  COUNT(*) FILTER (WHERE stock_quantity = 0) as sin_stock
FROM products;

-- 2. TODOS LOS PRODUCTOS (Vista completa)
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'LISTADO COMPLETO DE PRODUCTOS'
UNION ALL
SELECT '========================================';

SELECT 
  sku,
  name as nombre,
  brand as marca,
  sale_price as precio,
  stock_quantity as stock,
  CASE 
    WHEN stock_quantity = 0 THEN '❌ Sin stock'
    WHEN stock_quantity <= min_stock THEN '⚠️ Stock bajo'
    ELSE '✅ Stock OK'
  END as estado_stock,
  CASE WHEN has_offer THEN '🔥 En oferta' ELSE '' END as oferta,
  CASE WHEN featured THEN '⭐ Destacado' ELSE '' END as destacado
FROM products
ORDER BY name;

-- 3. PRODUCTOS POR CATEGORIA
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'PRODUCTOS POR CATEGORIA'
UNION ALL
SELECT '========================================';

SELECT 
  c.name as categoria,
  COUNT(p.id) as cantidad_productos,
  SUM(p.stock_quantity) as stock_total,
  ROUND(AVG(p.sale_price)::numeric, 2) as precio_promedio,
  SUM(p.stock_quantity * p.sale_price) as valor_inventario
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name
ORDER BY cantidad_productos DESC;

-- 4. PRODUCTOS DESTACADOS
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'PRODUCTOS DESTACADOS'
UNION ALL
SELECT '========================================';

SELECT 
  sku,
  name as nombre,
  brand as marca,
  sale_price as precio,
  stock_quantity as stock
FROM products
WHERE featured = true
ORDER BY name;

-- 5. PRODUCTOS EN OFERTA
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'PRODUCTOS EN OFERTA'
UNION ALL
SELECT '========================================';

SELECT 
  sku,
  name as nombre,
  sale_price as precio_normal,
  offer_price as precio_oferta,
  ROUND(((sale_price - offer_price) / sale_price * 100)::numeric, 1) as descuento_porcentaje,
  (sale_price - offer_price) as ahorro
FROM products
WHERE has_offer = true
ORDER BY descuento_porcentaje DESC;

-- 6. PRODUCTOS CON STOCK BAJO O AGOTADO
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'ALERTAS DE INVENTARIO'
UNION ALL
SELECT '========================================';

SELECT 
  sku,
  name as nombre,
  stock_quantity as stock_actual,
  min_stock as stock_minimo,
  CASE 
    WHEN stock_quantity = 0 THEN '❌ AGOTADO'
    WHEN stock_quantity <= min_stock THEN '⚠️ STOCK BAJO'
  END as alerta
FROM products
WHERE stock_quantity <= min_stock
ORDER BY stock_quantity;

-- 7. TOP 5 PRODUCTOS MAS CAROS
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'TOP 5 PRODUCTOS MAS CAROS'
UNION ALL
SELECT '========================================';

SELECT 
  sku,
  name as nombre,
  brand as marca,
  sale_price as precio,
  stock_quantity as stock
FROM products
ORDER BY sale_price DESC
LIMIT 5;

-- 8. PRODUCTOS POR PROVEEDOR
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'PRODUCTOS POR PROVEEDOR'
UNION ALL
SELECT '========================================';

SELECT 
  s.name as proveedor,
  COUNT(p.id) as cantidad_productos,
  SUM(p.stock_quantity) as stock_total,
  SUM(p.stock_quantity * p.sale_price) as valor_inventario
FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.id
GROUP BY s.name
ORDER BY cantidad_productos DESC;

-- 9. ESTADISTICAS DE PRECIOS
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'ESTADISTICAS DE PRECIOS'
UNION ALL
SELECT '========================================';

SELECT 
  ROUND(MIN(sale_price)::numeric, 2) as precio_minimo,
  ROUND(MAX(sale_price)::numeric, 2) as precio_maximo,
  ROUND(AVG(sale_price)::numeric, 2) as precio_promedio,
  ROUND(AVG((sale_price - purchase_price) / sale_price * 100)::numeric, 2) as margen_promedio_porcentaje
FROM products;

-- 10. VALOR TOTAL DEL INVENTARIO
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'VALOR DEL INVENTARIO'
UNION ALL
SELECT '========================================';

SELECT 
  SUM(stock_quantity) as unidades_totales,
  ROUND(SUM(stock_quantity * purchase_price)::numeric, 2) as costo_total,
  ROUND(SUM(stock_quantity * sale_price)::numeric, 2) as valor_venta,
  ROUND(SUM(stock_quantity * (sale_price - purchase_price))::numeric, 2) as ganancia_potencial
FROM products;

-- 11. PRODUCTOS CON IMAGENES
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'PRODUCTOS CON IMAGENES'
UNION ALL
SELECT '========================================';

SELECT 
  COUNT(*) as total_productos,
  COUNT(*) FILTER (WHERE images IS NOT NULL AND array_length(images, 1) > 0) as con_imagenes,
  COUNT(*) FILTER (WHERE images IS NULL OR array_length(images, 1) = 0) as sin_imagenes,
  ROUND((COUNT(*) FILTER (WHERE images IS NOT NULL AND array_length(images, 1) > 0)::numeric / COUNT(*)::numeric * 100), 1) as porcentaje_con_imagenes
FROM products;

-- 12. ULTIMOS 5 PRODUCTOS AGREGADOS
SELECT 
  '========================================' as separador
UNION ALL
SELECT 'ULTIMOS 5 PRODUCTOS AGREGADOS'
UNION ALL
SELECT '========================================';

SELECT 
  sku,
  name as nombre,
  brand as marca,
  sale_price as precio,
  created_at as fecha_creacion
FROM products
ORDER BY created_at DESC
LIMIT 5;
