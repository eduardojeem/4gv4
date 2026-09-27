-- SCRIPT DE VERIFICACION: Revisar estado actual de la base de datos
-- Ejecuta este script en Supabase SQL Editor para ver que existe

-- Ver TODAS las tablas en el schema public
SELECT 
  table_name,
  '✓ Existe' as estado
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar tablas especificas del sistema de productos
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') 
    THEN '✓ categories - EXISTE'
    ELSE '✗ categories - FALTA'
  END as tabla_categories,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') 
    THEN '✓ suppliers - EXISTE'
    ELSE '✗ suppliers - FALTA'
  END as tabla_suppliers,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') 
    THEN '✓ products - EXISTE'
    ELSE '✗ products - FALTA'
  END as tabla_products,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_movements') 
    THEN '✓ product_movements - EXISTE'
    ELSE '✗ product_movements - FALTA'
  END as tabla_movements,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_price_history') 
    THEN '✓ product_price_history - EXISTE'
    ELSE '✗ product_price_history - FALTA'
  END as tabla_price_history,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_alerts') 
    THEN '✓ product_alerts - EXISTE'
    ELSE '✗ product_alerts - FALTA'
  END as tabla_alerts;

-- Ver columnas de la tabla products (si existe)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'products'
ORDER BY ordinal_position;

-- Contar registros en cada tabla (si existen)
DO $$
DECLARE
  cat_count INTEGER := 0;
  sup_count INTEGER := 0;
  prod_count INTEGER := 0;
  mov_count INTEGER := 0;
BEGIN
  -- Contar categories
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    SELECT COUNT(*) INTO cat_count FROM categories;
  END IF;
  
  -- Contar suppliers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    SELECT COUNT(*) INTO sup_count FROM suppliers;
  END IF;
  
  -- Contar products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    SELECT COUNT(*) INTO prod_count FROM products;
  END IF;
  
  -- Contar movements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_movements') THEN
    SELECT COUNT(*) INTO mov_count FROM product_movements;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE REGISTROS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorías: %', cat_count;
  RAISE NOTICE 'Proveedores: %', sup_count;
  RAISE NOTICE 'Productos: %', prod_count;
  RAISE NOTICE 'Movimientos: %', mov_count;
  RAISE NOTICE '========================================';
END $$;

-- Ver indices existentes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE '%product%' OR tablename IN ('categories', 'suppliers'))
ORDER BY tablename, indexname;

-- Ver triggers existentes
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as tabla,
  tgenabled as habilitado
FROM pg_trigger
WHERE tgrelid::regclass::text IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts')
  AND tgname NOT LIKE 'RI_%'
ORDER BY tgrelid::regclass, tgname;

-- Ver funciones relacionadas
SELECT 
  proname as funcion,
  pg_get_functiondef(oid) as definicion
FROM pg_proc
WHERE proname IN ('update_updated_at_column', 'create_stock_movement', 'check_low_stock');

-- Resumen final
DO $$
DECLARE
  tables_count INTEGER;
  needed_tables TEXT[] := ARRAY['categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts'];
  existing_tables TEXT[];
  missing_tables TEXT[];
  tbl_name TEXT;
BEGIN
  -- Contar tablas existentes
  SELECT COUNT(*) INTO tables_count
  FROM information_schema.tables ist
  WHERE ist.table_schema = 'public' 
    AND ist.table_name = ANY(needed_tables);
  
  -- Obtener tablas existentes
  SELECT ARRAY_AGG(ist.table_name) INTO existing_tables
  FROM information_schema.tables ist
  WHERE ist.table_schema = 'public' 
    AND ist.table_name = ANY(needed_tables);
  
  -- Calcular tablas faltantes
  missing_tables := ARRAY[]::TEXT[];
  FOREACH tbl_name IN ARRAY needed_tables
  LOOP
    IF NOT (tbl_name = ANY(COALESCE(existing_tables, ARRAY[]::TEXT[]))) THEN
      missing_tables := array_append(missing_tables, tbl_name);
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN FINAL';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas necesarias: 6';
  RAISE NOTICE 'Tablas existentes: %', tables_count;
  RAISE NOTICE 'Tablas faltantes: %', 6 - tables_count;
  RAISE NOTICE '';
  
  IF tables_count = 6 THEN
    RAISE NOTICE 'TODAS LAS TABLAS EXISTEN';
    RAISE NOTICE 'Puedes ejecutar: 02_simple_seed.sql';
  ELSE
    RAISE NOTICE 'FALTAN TABLAS';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas que EXISTEN:';
    IF existing_tables IS NOT NULL THEN
      FOREACH tbl_name IN ARRAY existing_tables
      LOOP
        RAISE NOTICE '  - %', tbl_name;
      END LOOP;
    ELSE
      RAISE NOTICE '  (ninguna)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas que FALTAN:';
    IF array_length(missing_tables, 1) > 0 THEN
      FOREACH tbl_name IN ARRAY missing_tables
      LOOP
        RAISE NOTICE '  - %', tbl_name;
      END LOOP;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'ACCION RECOMENDADA:';
    RAISE NOTICE '1. Ejecuta: 01_simple_setup.sql';
    RAISE NOTICE '2. Luego ejecuta: 02_simple_seed.sql';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
