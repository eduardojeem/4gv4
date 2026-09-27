-- =====================================================
-- SCRIPT DE VERIFICACIÓN: Sistema de Productos
-- Fecha: 2024-12-06
-- Descripción: Verifica que las migraciones se ejecutaron correctamente
-- =====================================================

\echo '========================================='
\echo 'VERIFICACIÓN DE INSTALACIÓN'
\echo '========================================='
\echo ''

-- =====================================================
-- 1. VERIFICAR TABLAS
-- =====================================================

\echo '1. Verificando tablas...'
\echo ''

SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts')
    THEN '✓'
    ELSE '✗'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts')
ORDER BY table_name;

\echo ''

-- =====================================================
-- 2. CONTAR REGISTROS
-- =====================================================

\echo '2. Contando registros...'
\echo ''

SELECT 
  'Categorías' as tabla,
  COUNT(*) as registros,
  CASE WHEN COUNT(*) >= 11 THEN '✓' ELSE '✗' END as status
FROM categories
UNION ALL
SELECT 
  'Proveedores',
  COUNT(*),
  CASE WHEN COUNT(*) >= 5 THEN '✓' ELSE '✗' END
FROM suppliers
UNION ALL
SELECT 
  'Productos',
  COUNT(*),
  CASE WHEN COUNT(*) >= 18 THEN '✓' ELSE '✗' END
FROM products
UNION ALL
SELECT 
  'Movimientos',
  COUNT(*),
  CASE WHEN COUNT(*) >= 4 THEN '✓' ELSE '✗' END
FROM product_movements
UNION ALL
SELECT 
  'Historial Precios',
  COUNT(*),
  CASE WHEN COUNT(*) >= 2 THEN '✓' ELSE '✗' END
FROM product_price_history;

\echo ''

-- =====================================================
-- 3. VERIFICAR ÍNDICES
-- =====================================================

\echo '3. Verificando índices principales...'
\echo ''

SELECT 
  tablename,
  indexname,
  '✓' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'categories', 'suppliers')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname
LIMIT 10;

\echo ''

-- =====================================================
-- 4. VERIFICAR TRIGGERS
-- =====================================================

\echo '4. Verificando triggers...'
\echo ''

SELECT 
  tgname as trigger_name,
  tgrelid::regclass as tabla,
  '✓' as status
FROM pg_trigger 
WHERE tgname IN (
  'update_categories_updated_at',
  'update_suppliers_updated_at',
  'update_products_updated_at',
  'auto_create_stock_movement',
  'check_product_stock'
)
ORDER BY tgname;

\echo ''

-- =====================================================
-- 5. VERIFICAR VISTAS
-- =====================================================

\echo '5. Verificando vistas...'
\echo ''

SELECT 
  table_name as vista,
  '✓' as status
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('products_full', 'product_stats')
ORDER BY table_name;

\echo ''

-- =====================================================
-- 6. VERIFICAR RLS
-- =====================================================

\echo '6. Verificando Row Level Security...'
\echo ''

SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✓ Habilitado' ELSE '✗ Deshabilitado' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts')
ORDER BY tablename;

\echo ''

-- =====================================================
-- 7. ESTADÍSTICAS GENERALES
-- =====================================================

\echo '7. Estadísticas generales...'
\echo ''

SELECT * FROM product_stats;

\echo ''

-- =====================================================
-- 8. PRODUCTOS DE PRUEBA
-- =====================================================

\echo '8. Productos de prueba (primeros 5)...'
\echo ''

SELECT 
  sku,
  name,
  sale_price,
  stock_quantity,
  CASE 
    WHEN stock_quantity = 0 THEN '✗ Sin stock'
    WHEN stock_quantity <= min_stock THEN '⚠ Stock bajo'
    ELSE '✓ Stock OK'
  END as estado_stock
FROM products 
ORDER BY created_at 
LIMIT 5;

\echo ''

-- =====================================================
-- 9. ALERTAS GENERADAS
-- =====================================================

\echo '9. Alertas generadas automáticamente...'
\echo ''

SELECT 
  type,
  COUNT(*) as cantidad,
  '✓' as status
FROM product_alerts 
GROUP BY type
ORDER BY type;

\echo ''

-- =====================================================
-- 10. RESUMEN FINAL
-- =====================================================

\echo '========================================='
\echo 'RESUMEN DE VERIFICACIÓN'
\echo '========================================='
\echo ''

DO $$
DECLARE
  tables_ok BOOLEAN;
  data_ok BOOLEAN;
  triggers_ok BOOLEAN;
  views_ok BOOLEAN;
BEGIN
  -- Verificar tablas
  SELECT COUNT(*) = 6 INTO tables_ok
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts');
  
  -- Verificar datos
  SELECT 
    (SELECT COUNT(*) FROM categories) >= 11 AND
    (SELECT COUNT(*) FROM suppliers) >= 5 AND
    (SELECT COUNT(*) FROM products) >= 18
  INTO data_ok;
  
  -- Verificar triggers
  SELECT COUNT(*) >= 5 INTO triggers_ok
  FROM pg_trigger 
  WHERE tgname IN (
    'update_categories_updated_at',
    'update_suppliers_updated_at',
    'update_products_updated_at',
    'auto_create_stock_movement',
    'check_product_stock'
  );
  
  -- Verificar vistas
  SELECT COUNT(*) = 2 INTO views_ok
  FROM information_schema.views 
  WHERE table_schema = 'public' 
    AND table_name IN ('products_full', 'product_stats');
  
  -- Mostrar resultados
  RAISE NOTICE 'Tablas creadas: %', CASE WHEN tables_ok THEN '✓ OK' ELSE '✗ ERROR' END;
  RAISE NOTICE 'Datos insertados: %', CASE WHEN data_ok THEN '✓ OK' ELSE '✗ ERROR' END;
  RAISE NOTICE 'Triggers activos: %', CASE WHEN triggers_ok THEN '✓ OK' ELSE '✗ ERROR' END;
  RAISE NOTICE 'Vistas creadas: %', CASE WHEN views_ok THEN '✓ OK' ELSE '✗ ERROR' END;
  RAISE NOTICE '';
  
  IF tables_ok AND data_ok AND triggers_ok AND views_ok THEN
    RAISE NOTICE '✓✓✓ INSTALACIÓN EXITOSA ✓✓✓';
    RAISE NOTICE 'El sistema de productos está listo para usar.';
  ELSE
    RAISE NOTICE '✗✗✗ INSTALACIÓN INCOMPLETA ✗✗✗';
    RAISE NOTICE 'Revisa los errores anteriores.';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- CONSULTAS ÚTILES PARA TESTING
-- =====================================================

\echo ''
\echo 'CONSULTAS ÚTILES:'
\echo ''
\echo '-- Ver todos los productos:'
\echo 'SELECT * FROM products_full;'
\echo ''
\echo '-- Ver productos con stock bajo:'
\echo 'SELECT * FROM products WHERE stock_quantity <= min_stock;'
\echo ''
\echo '-- Ver alertas activas:'
\echo 'SELECT * FROM product_alerts WHERE read = false;'
\echo ''
\echo '-- Ver movimientos recientes:'
\echo 'SELECT * FROM product_movements ORDER BY created_at DESC LIMIT 10;'
\echo ''
\echo '-- Buscar productos:'
\echo 'SELECT * FROM products WHERE name ILIKE ''%iphone%'';'
\echo ''

-- =====================================================
-- FIN DEL SCRIPT DE VERIFICACIÓN
-- =====================================================
