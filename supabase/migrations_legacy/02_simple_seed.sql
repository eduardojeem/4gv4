-- =====================================================
-- DATOS DE EJEMPLO: Sistema de Productos
-- Ejecutar DESPUES de crear las tablas
-- =====================================================

-- Limpiar datos existentes (opcional, comentar si no quieres limpiar)
-- TRUNCATE TABLE product_alerts CASCADE;
-- TRUNCATE TABLE product_price_history CASCADE;
-- TRUNCATE TABLE product_movements CASCADE;
-- TRUNCATE TABLE products CASCADE;

-- Insertar Categorias (solo columnas basicas)
INSERT INTO categories (id, name) VALUES
('11111111-1111-1111-1111-111111111111', 'Electrónica'),
('22222222-2222-2222-2222-222222222222', 'Ropa y Accesorios'),
('33333333-3333-3333-3333-333333333333', 'Hogar y Cocina'),
('44444444-4444-4444-4444-444444444444', 'Deportes'),
('55555555-5555-5555-5555-555555555555', 'Alimentos')
ON CONFLICT (id) DO NOTHING;

-- Insertar Proveedores (con campos requeridos)
INSERT INTO suppliers (id, name, contact_name, email, phone, address, tax_id, is_active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Distributors SA', 'Carlos Méndez', 'carlos@techdist.com', '+595-21-555-0001', 'Av. Mariscal López 1234', NULL, true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fashion Import Co', 'María González', 'maria@fashionimport.com', '+595-21-555-0002', 'Av. España 5678', NULL, true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Alimentos del Valle', 'Juan Pérez', 'juan@alimentosvalle.com', '+595-21-555-0003', 'Ruta 2 Km 25', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PRODUCTOS DE EJEMPLO
-- =====================================================

INSERT INTO products (
  id, sku, name, description, category_id, brand, supplier_id,
  purchase_price, sale_price, wholesale_price, offer_price, has_offer,
  stock_quantity, min_stock, max_stock, unit_measure, barcode, 
  images, is_active, featured
) VALUES
-- =====================================================
-- ELECTRONICA (6 productos)
-- =====================================================
(
  '10000000-0000-0000-0000-000000000001',
  'IPHONE-14-PRO-128',
  'iPhone 14 Pro 128GB',
  'iPhone 14 Pro con pantalla Super Retina XDR de 6.1 pulgadas, chip A16 Bionic y sistema de cámara Pro avanzado',
  '11111111-1111-1111-1111-111111111111',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  18000.00, 24999.00, 23500.00, NULL, false,
  15, 5, 50, 'unidad', '7501234567890',
  ARRAY['https://images.unsplash.com/photo-1678652197950-1c6c5b0d3d8d?w=800', 'https://images.unsplash.com/photo-1678911820864-e2c567c655d7?w=800'],
  true, true
),
(
  '10000000-0000-0000-0000-000000000002',
  'SAMSUNG-S23-256',
  'Samsung Galaxy S23 256GB',
  'Samsung Galaxy S23 con pantalla Dynamic AMOLED 2X de 6.1", procesador Snapdragon 8 Gen 2 y cámara de 50MP',
  '11111111-1111-1111-1111-111111111111',
  'Samsung',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  14000.00, 19999.00, 18500.00, 17999.00, true,
  22, 5, 40, 'unidad', '7501234567891',
  ARRAY['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800'],
  true, true
),
(
  '10000000-0000-0000-0000-000000000003',
  'MACBOOK-AIR-M2-256',
  'MacBook Air M2 13" 256GB',
  'MacBook Air con chip M2, pantalla Liquid Retina de 13.6", 8GB RAM y 256GB SSD',
  '11111111-1111-1111-1111-111111111111',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  20000.00, 28999.00, 27500.00, NULL, false,
  8, 3, 20, 'unidad', '7501234567892',
  ARRAY['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800'],
  true, true
),
(
  '10000000-0000-0000-0000-000000000004',
  'AIRPODS-PRO-2',
  'AirPods Pro 2da Generación',
  'AirPods Pro con cancelación activa de ruido, audio espacial y estuche MagSafe',
  '11111111-1111-1111-1111-111111111111',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  3500.00, 5999.00, 5500.00, NULL, false,
  45, 15, 100, 'unidad', '7501234567893',
  ARRAY['https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800'],
  true, true
),
(
  '10000000-0000-0000-0000-000000000005',
  'XIAOMI-13-128',
  'Xiaomi 13 128GB',
  'Xiaomi 13 con pantalla AMOLED de 6.36", Snapdragon 8 Gen 2 y cámara Leica',
  '11111111-1111-1111-1111-111111111111',
  'Xiaomi',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  9000.00, 13999.00, 12999.00, NULL, false,
  30, 10, 60, 'unidad', '7501234567894',
  ARRAY['https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800'],
  true, false
),
(
  '10000000-0000-0000-0000-000000000006',
  'DELL-XPS-13-512',
  'Dell XPS 13 Intel i7 512GB',
  'Dell XPS 13 con procesador Intel Core i7, 16GB RAM y 512GB SSD',
  '11111111-1111-1111-1111-111111111111',
  'Dell',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  18000.00, 25999.00, 24500.00, 23999.00, true,
  5, 2, 15, 'unidad', '7501234567895',
  ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800'],
  true, false
),
-- =====================================================
-- ROPA Y ACCESORIOS (3 productos)
-- =====================================================
(
  '20000000-0000-0000-0000-000000000001',
  'CAMISETA-NIKE-DRI-M',
  'Camiseta Nike Dri-FIT Talla M',
  'Camiseta deportiva Nike con tecnología Dri-FIT para mantener la piel seca',
  '22222222-2222-2222-2222-222222222222',
  'Nike',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  250.00, 599.00, 550.00, 499.00, true,
  120, 30, 200, 'unidad', '7501234567896',
  ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
  true, false
),
(
  '20000000-0000-0000-0000-000000000002',
  'JEANS-LEVIS-501-32',
  'Jeans Levi''s 501 Original Talla 32',
  'Jeans clásicos Levi''s 501 Original Fit, el jean icónico desde 1873',
  '22222222-2222-2222-2222-222222222222',
  'Levi''s',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  600.00, 1299.00, 1200.00, NULL, false,
  65, 20, 150, 'unidad', '7501234567897',
  ARRAY['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
  true, true
),
(
  '20000000-0000-0000-0000-000000000003',
  'TENIS-ADIDAS-42',
  'Tenis Adidas Ultraboost 22 Talla 42',
  'Tenis para correr Adidas Ultraboost 22 con tecnología BOOST',
  '22222222-2222-2222-2222-222222222222',
  'Adidas',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  1200.00, 2499.00, 2300.00, 2199.00, true,
  35, 10, 80, 'par', '7501234567898',
  ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'],
  true, true
),
-- =====================================================
-- HOGAR Y COCINA (2 productos)
-- =====================================================
(
  '30000000-0000-0000-0000-000000000001',
  'LICUADORA-OSTER-1200W',
  'Licuadora Oster 1200W 3 Velocidades',
  'Licuadora Oster con motor de 1200W, vaso de vidrio de 1.5L y 3 velocidades',
  '33333333-3333-3333-3333-333333333333',
  'Oster',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  800.00, 1599.00, 1450.00, NULL, false,
  25, 8, 50, 'unidad', '7501234567899',
  ARRAY['https://images.unsplash.com/photo-1585515320310-259814833e62?w=800'],
  true, false
),
(
  '30000000-0000-0000-0000-000000000002',
  'JUEGO-SARTENES-5PZ',
  'Juego de Sartenes Antiadherentes 5 Piezas',
  'Set de 5 sartenes con recubrimiento antiadherente de cerámica',
  '33333333-3333-3333-3333-333333333333',
  'T-fal',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  600.00, 1299.00, 1150.00, 999.00, true,
  18, 5, 40, 'juego', '7501234567900',
  ARRAY['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800'],
  true, false
),
-- =====================================================
-- DEPORTES (2 productos)
-- =====================================================
(
  '40000000-0000-0000-0000-000000000001',
  'BALON-FUTBOL-NIKE-5',
  'Balón de Fútbol Nike Strike Talla 5',
  'Balón de fútbol Nike Strike con gráficos de alto contraste',
  '44444444-4444-4444-4444-444444444444',
  'Nike',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  300.00, 699.00, 650.00, NULL, false,
  50, 15, 100, 'unidad', '7501234567901',
  ARRAY['https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=800'],
  true, false
),
(
  '40000000-0000-0000-0000-000000000002',
  'MANCUERNAS-10KG-PAR',
  'Mancuernas Hexagonales 10kg (Par)',
  'Par de mancuernas hexagonales de 10kg cada una, recubiertas de goma',
  '44444444-4444-4444-4444-444444444444',
  'Rogue',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  800.00, 1599.00, 1450.00, 1399.00, true,
  12, 4, 30, 'par', '7501234567902',
  ARRAY['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800'],
  true, true
),
-- =====================================================
-- ALIMENTOS (3 productos - con stock bajo para testing)
-- =====================================================
(
  '50000000-0000-0000-0000-000000000001',
  'CAFE-ARABICA-1KG',
  'Café Arábica Premium 1kg',
  'Café 100% arábica de altura, tostado medio, notas de chocolate',
  '55555555-5555-5555-5555-555555555555',
  'Café del Valle',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  180.00, 399.00, 370.00, NULL, false,
  8, 20, 100, 'kg', '7501234567903',
  ARRAY['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800'],
  true, false
),
(
  '50000000-0000-0000-0000-000000000002',
  'ACEITE-OLIVA-500ML',
  'Aceite de Oliva Extra Virgen 500ml',
  'Aceite de oliva extra virgen prensado en frío',
  '55555555-5555-5555-5555-555555555555',
  'La Española',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  120.00, 249.00, 230.00, 199.00, true,
  3, 15, 80, 'unidad', '7501234567904',
  ARRAY['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800'],
  true, false
),
(
  '50000000-0000-0000-0000-000000000003',
  'MIEL-ORGANICA-500G',
  'Miel de Abeja Orgánica 500g',
  'Miel 100% pura de abeja, certificada orgánica, sin aditivos',
  '55555555-5555-5555-5555-555555555555',
  'Miel del Campo',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  150.00, 299.00, 280.00, NULL, false,
  0, 10, 60, 'unidad', '7501234567905',
  ARRAY['https://images.unsplash.com/photo-1587049352846-4a222e784acc?w=800'],
  true, false
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- MOVIMIENTOS DE INVENTARIO (Historial)
-- =====================================================

INSERT INTO product_movements (
  product_id, movement_type, quantity, previous_stock, new_stock, 
  unit_cost, total_cost, notes
) VALUES
-- Entrada inicial de iPhone
(
  '10000000-0000-0000-0000-000000000001',
  'entrada', 20, 0, 20,
  18000.00, 360000.00, 'Compra inicial de inventario'
),
-- Venta de iPhone
(
  '10000000-0000-0000-0000-000000000001',
  'venta', 5, 20, 15,
  18000.00, 90000.00, 'Venta a cliente'
),
-- Entrada de Samsung
(
  '10000000-0000-0000-0000-000000000002',
  'entrada', 30, 0, 30,
  14000.00, 420000.00, 'Compra inicial de inventario'
),
-- Venta de Samsung
(
  '10000000-0000-0000-0000-000000000002',
  'venta', 8, 30, 22,
  14000.00, 112000.00, 'Venta a cliente'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- MENSAJE DE CONFIRMACION
-- =====================================================

DO $$
DECLARE
  cat_count INTEGER;
  sup_count INTEGER;
  prod_count INTEGER;
  mov_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count FROM categories;
  SELECT COUNT(*) INTO sup_count FROM suppliers;
  SELECT COUNT(*) INTO prod_count FROM products;
  SELECT COUNT(*) INTO mov_count FROM product_movements;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATOS INSERTADOS EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorias: %', cat_count;
  RAISE NOTICE 'Proveedores: %', sup_count;
  RAISE NOTICE 'Productos: %', prod_count;
  RAISE NOTICE 'Movimientos: %', mov_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Productos por categoria:';
  RAISE NOTICE '  - Electronica: 6 productos';
  RAISE NOTICE '  - Ropa y Accesorios: 3 productos';
  RAISE NOTICE '  - Hogar y Cocina: 2 productos';
  RAISE NOTICE '  - Deportes: 2 productos';
  RAISE NOTICE '  - Alimentos: 3 productos';
  RAISE NOTICE '';
  RAISE NOTICE 'Productos destacados: 6';
  RAISE NOTICE 'Productos en oferta: 6';
  RAISE NOTICE 'Productos con stock bajo: 2';
  RAISE NOTICE 'Productos sin stock: 1';
  RAISE NOTICE '========================================';
END $$;
