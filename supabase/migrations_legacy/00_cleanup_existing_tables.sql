-- =====================================================
-- SCRIPT DE LIMPIEZA: Sistema de Productos
-- Fecha: 2024-12-06
-- Descripción: Elimina tablas existentes para reinstalación limpia
-- ADVERTENCIA: Este script eliminará TODOS los datos existentes
-- =====================================================

-- =====================================================
-- IMPORTANTE: BACKUP
-- =====================================================
-- Antes de ejecutar este script, asegúrate de hacer backup si tienes datos importantes:
-- pg_dump -h [HOST] -U postgres -d postgres -t products -t categories -t suppliers > backup.sql

\echo '========================================='
\echo 'ADVERTENCIA: LIMPIEZA DE TABLAS'
\echo '========================================='
\echo 'Este script eliminará todas las tablas del sistema de productos.'
\echo 'Presiona Ctrl+C para cancelar o continúa para proceder.'
\echo ''

-- =====================================================
-- DESACTIVAR RLS TEMPORALMENTE
-- =====================================================

ALTER TABLE IF EXISTS product_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_price_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- ELIMINAR POLÍTICAS RLS
-- =====================================================

DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_alerts;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_price_history;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON product_movements;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON suppliers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON categories;

-- =====================================================
-- ELIMINAR VISTAS
-- =====================================================

DROP VIEW IF EXISTS products_full CASCADE;
DROP VIEW IF EXISTS product_stats CASCADE;

-- =====================================================
-- ELIMINAR TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS check_product_stock ON products;
DROP TRIGGER IF EXISTS auto_create_stock_movement ON products;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;

-- =====================================================
-- ELIMINAR FUNCIONES
-- =====================================================

DROP FUNCTION IF EXISTS check_low_stock() CASCADE;
DROP FUNCTION IF EXISTS create_stock_movement() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- ELIMINAR TABLAS (en orden inverso de dependencias)
-- =====================================================

DROP TABLE IF EXISTS product_alerts CASCADE;
DROP TABLE IF EXISTS product_price_history CASCADE;
DROP TABLE IF EXISTS product_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- =====================================================
-- VERIFICAR LIMPIEZA
-- =====================================================

DO $$
DECLARE
  remaining_tables INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_tables
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('categories', 'suppliers', 'products', 'product_movements', 'product_price_history', 'product_alerts');
  
  IF remaining_tables = 0 THEN
    RAISE NOTICE '✓ Limpieza completada exitosamente';
    RAISE NOTICE 'Todas las tablas han sido eliminadas';
    RAISE NOTICE '';
    RAISE NOTICE 'Ahora puedes ejecutar:';
    RAISE NOTICE '1. 20241206_create_products_tables.sql';
    RAISE NOTICE '2. 20241206_seed_products_data.sql';
  ELSE
    RAISE NOTICE '⚠ Advertencia: Aún quedan % tablas', remaining_tables;
  END IF;
END $$;

-- =====================================================
-- FIN DEL SCRIPT DE LIMPIEZA
-- =====================================================
