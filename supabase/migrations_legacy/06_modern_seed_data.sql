-- =====================================================
-- SEED MODERNO: Datos de Ejemplo con Nuevas Características
-- =====================================================

BEGIN;

-- Limpiar datos existentes (opcional)
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE suppliers CASCADE;

-- =====================================================
-- CATEGORÍAS MODERNAS
-- =====================================================

INSERT INTO categories (id, name, slug, description, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Smartphones', 'smartphones', 'Teléfonos inteligentes de última generación', true),
('22222222-2222-2222-2222-222222222222', 'Laptops', 'laptops', 'Computadoras portátiles y notebooks', true),
('33333333-3333-3333-3333-333333333333', 'Audio', 'audio', 'Audífonos, parlantes y accesorios de audio', true),
('44444444-4444-4444-4444-444444444444', 'Wearables', 'wearables', 'Smartwatches y dispositivos vestibles', true),
('55555555-5555-5555-5555-555555555555', 'Accesorios', 'accesorios', 'Accesorios y complementos tecnológicos', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PROVEEDORES MODERNOS
-- =====================================================

INSERT INTO suppliers (
  id, name, contact_person, email, phone, 
  address, city, country, business_type, status, rating
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Tech Global SA',
  'Roberto Martínez',
  'roberto@techglobal.com',
  '+595-21-555-1000',
  'Av. Mariscal López 2500',
  'Asunción',
  'Paraguay',
  'distributor',
  'active',
  5
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Digital Import Co',
  'Ana Silva',
  'ana@digitalimport.com',
  '+595-21-555-2000',
  'Av. España 3000',
  'Asunción',
  'Paraguay',
  'wholesaler',
  'active',
  4
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =====================================================
-- PRODUCTOS MODERNOS CON TODAS LAS CARACTERÍSTICAS
-- =====================================================

BEGIN;

-- Producto 1: iPhone 15 Pro (Destacado, Bestseller)
INSERT INTO products (
  id, sku, name, display_name, short_description,
  category_id, brand, model, color, supplier_id,
  purchase_price, sale_price, compare_at_price,
  stock_quantity, min_stock, unit_measure,
  thumbnail, video_url,
  specifications, features, search_keywords,
  is_active, featured, is_new, is_bestseller,
  promotion_label, sort_order, priority,
  warranty_info, shipping_info,
  meta_title, meta_description
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'IPH15PRO-128-TIT',
  'iPhone 15 Pro 128GB Titanio Natural',
  'iPhone 15 Pro',
  'El iPhone más Pro hasta ahora con chip A17 Pro y cámara de 48MP',
  '11111111-1111-1111-1111-111111111111',
  'Apple',
  'iPhone 15 Pro',
  'Titanio Natural',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  18000.00,
  24999.00,
  27999.00,
  15,
  5,
  'unidad',
  'https://images.unsplash.com/photo-1678652197950-1c6c5b0d3d8d?w=400',
  'https://www.youtube.com/watch?v=xqyUdNxWazA',
  '{"pantalla": "6.1 pulgadas Super Retina XDR", "procesador": "A17 Pro", "camara": "48MP principal", "bateria": "Hasta 23 horas de video", "almacenamiento": "128GB", "conectividad": "5G, WiFi 6E, Bluetooth 5.3"}'::jsonb,
  ARRAY['Chip A17 Pro revolucionario', 'Cámara de 48MP con zoom óptico 3x', 'Diseño de titanio resistente', 'Dynamic Island interactiva', 'USB-C con USB 3', 'Botón de Acción personalizable'],
  ARRAY['iphone', '15', 'pro', 'apple', 'smartphone', 'titanio', '5g', 'a17'],
  true,
  true,
  true,
  true,
  'BESTSELLER',
  1,
  'high',
  'Garantía Apple de 1 año. Cobertura contra defectos de fabricación.',
  'Envío gratis en Asunción. Entrega en 24-48 horas.',
  'iPhone 15 Pro 128GB - Comprar en Paraguay | Tech Global',
  'Compra el nuevo iPhone 15 Pro con chip A17 Pro, cámara de 48MP y diseño de titanio. Envío gratis y garantía oficial Apple.'
);

-- Producto 2: Samsung Galaxy S24 Ultra (En oferta)
INSERT INTO products (
  id, sku, name, display_name, short_description,
  category_id, brand, model, color, supplier_id,
  purchase_price, sale_price, compare_at_price,
  stock_quantity, min_stock, unit_measure,
  thumbnail,
  specifications, features, search_keywords,
  is_active, featured, is_trending,
  promotion_label, promotion_start, promotion_end,
  sort_order, priority,
  warranty_info, shipping_info
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  'SGS24U-256-BLK',
  'Samsung Galaxy S24 Ultra 256GB Negro Titanio',
  'Galaxy S24 Ultra',
  'El smartphone más potente de Samsung con S Pen integrado',
  '11111111-1111-1111-1111-111111111111',
  'Samsung',
  'Galaxy S24 Ultra',
  'Negro Titanio',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  16000.00,
  21999.00,
  25999.00,
  22,
  5,
  'unidad',
  'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400',
  '{"pantalla": "6.8 pulgadas Dynamic AMOLED 2X", "procesador": "Snapdragon 8 Gen 3", "camara": "200MP principal", "bateria": "5000mAh", "almacenamiento": "256GB", "spen": "Incluido"}'::jsonb,
  ARRAY['Cámara de 200MP con zoom 100x', 'S Pen integrado', 'Pantalla de 6.8 pulgadas', 'Batería de 5000mAh', 'Galaxy AI integrada', 'Resistente al agua IP68'],
  ARRAY['samsung', 'galaxy', 's24', 'ultra', 'android', 'spen', '200mp'],
  true,
  true,
  true,
  'OFERTA',
  NOW(),
  NOW() + INTERVAL '7 days',
  2,
  'high',
  'Garantía Samsung de 1 año',
  'Envío gratis en todo Paraguay'
);

-- Producto 3: MacBook Air M3 (Nuevo)
INSERT INTO products (
  id, sku, name, display_name, short_description,
  category_id, brand, model, color, supplier_id,
  purchase_price, sale_price,
  stock_quantity, min_stock, unit_measure,
  thumbnail,
  specifications, features, search_keywords,
  is_active, featured, is_new,
  sort_order, priority,
  warranty_info
) VALUES (
  '10000000-0000-0000-0000-000000000003',
  'MBA-M3-13-256-SLV',
  'MacBook Air 13" M3 256GB Plata',
  'MacBook Air M3',
  'Ultradelgada, ultrapoderosa con chip M3',
  '22222222-2222-2222-2222-222222222222',
  'Apple',
  'MacBook Air M3',
  'Plata',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  20000.00,
  28999.00,
  8,
  3,
  'unidad',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
  '{"pantalla": "13.6 pulgadas Liquid Retina", "procesador": "Apple M3", "ram": "8GB", "almacenamiento": "256GB SSD", "bateria": "Hasta 18 horas", "peso": "1.24 kg"}'::jsonb,
  ARRAY['Chip M3 de última generación', 'Pantalla Liquid Retina de 13.6"', 'Hasta 18 horas de batería', 'Diseño ultradelgado', 'MagSafe 3', 'Touch ID'],
  ARRAY['macbook', 'air', 'm3', 'apple', 'laptop', 'notebook'],
  true,
  true,
  true,
  3,
  'high',
  'Garantía Apple de 1 año'
);

-- Producto 4: AirPods Pro 2 (Exclusivo)
INSERT INTO products (
  id, sku, name, display_name, short_description,
  category_id, brand, model, supplier_id,
  purchase_price, sale_price,
  stock_quantity, min_stock, unit_measure,
  thumbnail,
  specifications, features, search_keywords,
  is_active, featured, is_exclusive,
  sort_order,
  warranty_info
) VALUES (
  '10000000-0000-0000-0000-000000000004',
  'AIRPODS-PRO2-USB',
  'AirPods Pro 2da Generación USB-C',
  'AirPods Pro 2',
  'Cancelación de ruido activa adaptativa',
  '33333333-3333-3333-3333-333333333333',
  'Apple',
  'AirPods Pro 2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  3500.00,
  5999.00,
  45,
  15,
  'unidad',
  'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400',
  '{"cancelacion_ruido": "Activa adaptativa", "audio_espacial": "Personalizado", "bateria": "Hasta 6 horas", "resistencia": "IPX4", "chip": "H2"}'::jsonb,
  ARRAY['Cancelación activa de ruido', 'Audio espacial personalizado', 'Modo ambiente adaptativo', 'Estuche MagSafe con USB-C', 'Resistentes al agua IPX4', 'Hasta 30 horas con estuche'],
  ARRAY['airpods', 'pro', 'apple', 'audifonos', 'bluetooth', 'noise cancelling'],
  true,
  true,
  true,
  4,
  'Garantía Apple de 1 año'
);

-- Producto 5: Dell XPS 13 (Stock bajo)
INSERT INTO products (
  id, sku, name, display_name, short_description,
  category_id, brand, model, color, supplier_id,
  purchase_price, sale_price, compare_at_price,
  stock_quantity, min_stock, unit_measure,
  thumbnail,
  specifications, features, search_keywords,
  is_active, featured,
  promotion_label, promotion_start, promotion_end,
  restock_date,
  sort_order
) VALUES (
  '10000000-0000-0000-0000-000000000005',
  'DELL-XPS13-I7-512',
  'Dell XPS 13 Intel Core i7 512GB',
  'Dell XPS 13',
  'Laptop premium ultradelgada con pantalla InfinityEdge',
  '22222222-2222-2222-2222-222222222222',
  'Dell',
  'XPS 13',
  'Platino',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  18000.00,
  23999.00,
  26999.00,
  3,
  5,
  'unidad',
  'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=400',
  '{"pantalla": "13.4 pulgadas FHD+", "procesador": "Intel Core i7-1355U", "ram": "16GB", "almacenamiento": "512GB SSD", "grafica": "Intel Iris Xe"}'::jsonb,
  ARRAY['Pantalla InfinityEdge', 'Intel Core i7 13va Gen', '16GB RAM', '512GB SSD', 'Diseño premium en aluminio', 'Teclado retroiluminado'],
  ARRAY['dell', 'xps', 'laptop', 'intel', 'i7', 'ultrabook'],
  true,
  true,
  'ÚLTIMAS UNIDADES',
  NOW(),
  NOW() + INTERVAL '3 days',
  NOW() + INTERVAL '15 days',
  5
);

-- Producto 6: Apple Watch Series 9 (Nuevo, Trending)
INSERT INTO products (
  id, sku, name, display_name, short_description,
  category_id, brand, model, color, supplier_id,
  purchase_price, sale_price,
  stock_quantity, min_stock, unit_measure,
  thumbnail,
  specifications, features, search_keywords,
  is_active, featured, is_new, is_trending,
  sort_order,
  warranty_info
) VALUES (
  '10000000-0000-0000-0000-000000000006',
  'AW-S9-45-MID',
  'Apple Watch Series 9 GPS 45mm Medianoche',
  'Apple Watch S9',
  'El smartwatch más avanzado con chip S9',
  '44444444-4444-4444-4444-444444444444',
  'Apple',
  'Apple Watch Series 9',
  'Medianoche',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  6500.00,
  9999.00,
  30,
  10,
  'unidad',
  'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400',
  '{"pantalla": "45mm Retina LTPO OLED", "chip": "S9 SiP", "sensores": "Frecuencia cardíaca, ECG, Oxígeno en sangre", "resistencia": "50m agua", "bateria": "Hasta 18 horas"}'::jsonb,
  ARRAY['Chip S9 con doble toque', 'Pantalla siempre activa', 'Detección de caídas y choques', 'ECG y oxígeno en sangre', 'Resistente al agua 50m', 'watchOS 10'],
  ARRAY['apple', 'watch', 'series', '9', 'smartwatch', 'fitness'],
  true,
  true,
  true,
  true,
  6,
  'Garantía Apple de 1 año'
);

COMMIT;

-- Actualizar contadores de productos en suppliers
UPDATE suppliers SET products_count = (
  SELECT COUNT(*) FROM products WHERE supplier_id = suppliers.id
);

-- Mensaje de confirmación
DO $
DECLARE
  prod_count INTEGER;
  cat_count INTEGER;
  sup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO prod_count FROM products;
  SELECT COUNT(*) INTO cat_count FROM categories;
  SELECT COUNT(*) INTO sup_count FROM suppliers;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SEED MODERNO COMPLETADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorías: %', cat_count;
  RAISE NOTICE 'Proveedores: %', sup_count;
  RAISE NOTICE 'Productos: %', prod_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Productos destacados:';
  RAISE NOTICE '  - iPhone 15 Pro (Bestseller, Nuevo)';
  RAISE NOTICE '  - Galaxy S24 Ultra (En oferta, Trending)';
  RAISE NOTICE '  - MacBook Air M3 (Nuevo)';
  RAISE NOTICE '  - AirPods Pro 2 (Exclusivo)';
  RAISE NOTICE '  - Dell XPS 13 (Stock bajo, Oferta)';
  RAISE NOTICE '  - Apple Watch S9 (Nuevo, Trending)';
  RAISE NOTICE '';
  RAISE NOTICE '✨ Características modernas incluidas:';
  RAISE NOTICE '  - Slugs SEO-friendly';
  RAISE NOTICE '  - Especificaciones en JSONB';
  RAISE NOTICE '  - Badges (Nuevo, Bestseller, Trending)';
  RAISE NOTICE '  - Promociones con fechas';
  RAISE NOTICE '  - Descuentos calculados automáticamente';
  RAISE NOTICE '  - Stock status automático';
  RAISE NOTICE '========================================';
END $;
