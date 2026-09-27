-- VERIFICACION ULTRA SIMPLE
-- Ejecuta este script completo en Supabase SQL Editor

-- PASO 1: Ver TODAS las tablas que existen
SELECT 
  table_name,
  'Existe en tu base de datos' as estado
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- PASO 2: Verificar tablas necesarias (true = existe, false = no existe)
SELECT 
  'categories' as tabla_necesaria,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') as existe
UNION ALL
SELECT 
  'suppliers',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers')
UNION ALL
SELECT 
  'products',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products')
UNION ALL
SELECT 
  'product_movements',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_movements')
UNION ALL
SELECT 
  'product_price_history',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_price_history')
UNION ALL
SELECT 
  'product_alerts',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_alerts');
