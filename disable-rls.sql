-- Script SQL para deshabilitar RLS temporalmente y permitir inserción de productos
-- Ejecuta este script en el SQL Editor de Supabase

-- Deshabilitar RLS en las tablas principales
ALTER TABLE "public"."products" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sales" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sale_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."customers" DISABLE ROW LEVEL SECURITY;

-- Insertar categorías de ejemplo
INSERT INTO "public"."categories" (name, description) VALUES
('Smartphones', 'Teléfonos inteligentes y accesorios'),
('Audio', 'Auriculares, parlantes y equipos de audio'),
('Accesorios', 'Cables, cargadores, fundas y otros accesorios'),
('Computación', 'Teclados, mouse, tablets y equipos de computación')
ON CONFLICT (name) DO NOTHING;

-- Insertar productos de ejemplo
INSERT INTO "public"."products" (
  name, 
  description, 
  sku, 
  barcode, 
  sale_price, 
  wholesale_price, 
  stock_quantity, 
  min_stock_level, 
  unit_measure, 
  is_active, 
  is_featured, 
  images,
  category_id
) VALUES
(
  'Smartphone Samsung Galaxy A54',
  'Smartphone con cámara de 50MP y pantalla Super AMOLED de 6.4 pulgadas',
  'SAM-A54-128',
  '7891234567890',
  2500000,
  2200000,
  15,
  5,
  'unidad',
  true,
  true,
  ARRAY['📱'],
  (SELECT id FROM categories WHERE name = 'Smartphones' LIMIT 1)
),
(
  'Auriculares Bluetooth Sony WH-1000XM4',
  'Auriculares inalámbricos con cancelación de ruido activa',
  'SONY-WH1000XM4',
  '7891234567891',
  850000,
  750000,
  8,
  3,
  'unidad',
  true,
  true,
  ARRAY['🎧'],
  (SELECT id FROM categories WHERE name = 'Audio' LIMIT 1)
),
(
  'Cargador USB-C 25W Samsung',
  'Cargador rápido original Samsung con cable USB-C',
  'SAM-CHARGER-25W',
  '7891234567892',
  120000,
  100000,
  25,
  10,
  'unidad',
  true,
  false,
  ARRAY['🔌'],
  (SELECT id FROM categories WHERE name = 'Accesorios' LIMIT 1)
),
(
  'Funda Protectora iPhone 14',
  'Funda de silicona transparente para iPhone 14',
  'CASE-IP14-CLEAR',
  '7891234567893',
  45000,
  35000,
  50,
  20,
  'unidad',
  true,
  false,
  ARRAY['📱'],
  (SELECT id FROM categories WHERE name = 'Accesorios' LIMIT 1)
),
(
  'Teclado Mecánico Logitech MX Keys',
  'Teclado inalámbrico para productividad con retroiluminación',
  'LOG-MX-KEYS',
  '7891234567894',
  450000,
  400000,
  12,
  5,
  'unidad',
  true,
  true,
  ARRAY['⌨️'],
  (SELECT id FROM categories WHERE name = 'Computación' LIMIT 1)
),
(
  'Mouse Gaming Razer DeathAdder V3',
  'Mouse óptico para gaming con sensor de 30,000 DPI',
  'RAZ-DEATHADDER-V3',
  '7891234567895',
  280000,
  240000,
  20,
  8,
  'unidad',
  true,
  false,
  ARRAY['🖱️'],
  (SELECT id FROM categories WHERE name = 'Computación' LIMIT 1)
)
ON CONFLICT (sku) DO NOTHING;

-- Verificar que los productos se insertaron correctamente
SELECT 
  p.name,
  p.sku,
  p.sale_price,
  p.stock_quantity,
  p.is_active,
  c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = true
ORDER BY p.name;