-- =====================================================
-- SCRIPT DE DATOS DE EJEMPLO: Sistema de Productos
-- Fecha: 2024-12-06
-- Descripción: Inserta datos de ejemplo para testing
-- =====================================================

-- =====================================================
-- CATEGORÍAS
-- =====================================================

INSERT INTO categories (id, name, description, parent_id, is_active) VALUES
-- Categorías principales
('11111111-1111-1111-1111-111111111111', 'Electrónica', 'Productos electrónicos y tecnología', NULL, true),
('22222222-2222-2222-2222-222222222222', 'Ropa y Accesorios', 'Prendas de vestir y complementos', NULL, true),
('33333333-3333-3333-3333-333333333333', 'Hogar y Jardín', 'Artículos para el hogar y jardín', NULL, true),
('44444444-4444-4444-4444-444444444444', 'Deportes', 'Artículos deportivos y fitness', NULL, true),
('55555555-5555-5555-5555-555555555555', 'Alimentos y Bebidas', 'Productos alimenticios', NULL, true),

-- Subcategorías de Electrónica
('11111111-1111-1111-1111-111111111112', 'Smartphones', 'Teléfonos inteligentes', '11111111-1111-1111-1111-111111111111', true),
('11111111-1111-1111-1111-111111111113', 'Laptops', 'Computadoras portátiles', '11111111-1111-1111-1111-111111111111', true),
('11111111-1111-1111-1111-111111111114', 'Accesorios Tech', 'Accesorios para dispositivos', '11111111-1111-1111-1111-111111111111', true),

-- Subcategorías de Ropa
('22222222-2222-2222-2222-222222222223', 'Camisetas', 'Camisetas y playeras', '22222222-2222-2222-2222-222222222222', true),
('22222222-2222-2222-2222-222222222224', 'Pantalones', 'Pantalones y jeans', '22222222-2222-2222-2222-222222222222', true),
('22222222-2222-2222-2222-222222222225', 'Calzado', 'Zapatos y tenis', '22222222-2222-2222-2222-222222222222', true);

-- =====================================================
-- PROVEEDORES
-- =====================================================

INSERT INTO suppliers (id, name, contact_name, email, phone, address, tax_id, is_active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Distributors SA', 'Juan Pérez', 'contacto@techdist.com', '+52 55 1234 5678', 'Av. Reforma 123, CDMX', 'TDS123456ABC', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fashion Import Co', 'María García', 'ventas@fashionimport.com', '+52 55 8765 4321', 'Calle Moda 456, Guadalajara', 'FIC789012DEF', true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Home & Garden Supplies', 'Carlos López', 'info@homegardens.com', '+52 81 2345 6789', 'Blvd. Hogar 789, Monterrey', 'HGS345678GHI', true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Sports Pro México', 'Ana Martínez', 'contacto@sportspro.mx', '+52 33 9876 5432', 'Av. Deportes 321, Puebla', 'SPM901234JKL', true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Alimentos del Valle', 'Roberto Sánchez', 'ventas@alimentosvalle.com', '+52 55 5555 5555', 'Calle Alimentos 654, CDMX', 'ADV567890MNO', true);

-- =====================================================
-- PRODUCTOS - ELECTRÓNICA
-- =====================================================

INSERT INTO products (
  id, sku, name, description, category_id, brand, supplier_id,
  purchase_price, sale_price, wholesale_price, offer_price, has_offer,
  stock_quantity, min_stock, max_stock, unit_measure, barcode,
  images, weight, dimensions, location, tags, is_active, featured
) VALUES
-- Smartphones
(
  '10000000-0000-0000-0000-000000000001',
  'IPHONE-14-PRO-128',
  'iPhone 14 Pro 128GB',
  'iPhone 14 Pro con pantalla Super Retina XDR de 6.1 pulgadas, chip A16 Bionic, sistema de cámara Pro avanzado y Dynamic Island.',
  '11111111-1111-1111-1111-111111111112',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  18000.00, 24999.00, 23500.00, NULL, false,
  15, 5, 50, 'unidad', '7501234567890',
  ARRAY['https://images.unsplash.com/photo-1678652197950-1c6c5b0d3d8d?w=800', 'https://images.unsplash.com/photo-1678652197950-1c6c5b0d3d8d?w=800'],
  0.206, '14.7 x 7.15 x 0.78 cm', 'Estante A1', ARRAY['smartphone', 'apple', 'premium'], true, true
),
(
  '10000000-0000-0000-0000-000000000002',
  'SAMSUNG-S23-256',
  'Samsung Galaxy S23 256GB',
  'Samsung Galaxy S23 con pantalla Dynamic AMOLED 2X de 6.1", procesador Snapdragon 8 Gen 2 y cámara de 50MP.',
  '11111111-1111-1111-1111-111111111112',
  'Samsung',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  14000.00, 19999.00, 18500.00, 17999.00, true,
  22, 5, 40, 'unidad', '7501234567891',
  ARRAY['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800'],
  0.168, '14.6 x 7.06 x 0.76 cm', 'Estante A1', ARRAY['smartphone', 'samsung', 'android'], true, true
),
(
  '10000000-0000-0000-0000-000000000003',
  'XIAOMI-13-128',
  'Xiaomi 13 128GB',
  'Xiaomi 13 con pantalla AMOLED de 6.36", Snapdragon 8 Gen 2 y cámara Leica de 50MP.',
  '11111111-1111-1111-1111-111111111112',
  'Xiaomi',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  9000.00, 13999.00, 12999.00, NULL, false,
  30, 10, 60, 'unidad', '7501234567892',
  ARRAY['https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800'],
  0.185, '15.2 x 7.13 x 0.81 cm', 'Estante A2', ARRAY['smartphone', 'xiaomi', 'android'], true, false
),

-- Laptops
(
  '10000000-0000-0000-0000-000000000004',
  'MACBOOK-AIR-M2',
  'MacBook Air M2 13" 256GB',
  'MacBook Air con chip M2, pantalla Liquid Retina de 13.6", 8GB RAM y 256GB SSD.',
  '11111111-1111-1111-1111-111111111113',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  20000.00, 28999.00, 27500.00, NULL, false,
  8, 3, 20, 'unidad', '7501234567893',
  ARRAY['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800'],
  1.24, '30.41 x 21.5 x 1.13 cm', 'Estante B1', ARRAY['laptop', 'apple', 'macbook'], true, true
),
(
  '10000000-0000-0000-0000-000000000005',
  'DELL-XPS-13',
  'Dell XPS 13 Intel i7 512GB',
  'Dell XPS 13 con procesador Intel Core i7, 16GB RAM, 512GB SSD y pantalla InfinityEdge de 13.4".',
  '11111111-1111-1111-1111-111111111113',
  'Dell',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  18000.00, 25999.00, 24500.00, 23999.00, true,
  5, 2, 15, 'unidad', '7501234567894',
  ARRAY['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800'],
  1.27, '29.57 x 19.87 x 1.48 cm', 'Estante B1', ARRAY['laptop', 'dell', 'windows'], true, false
),

-- Accesorios
(
  '10000000-0000-0000-0000-000000000006',
  'AIRPODS-PRO-2',
  'AirPods Pro 2da Gen',
  'AirPods Pro con cancelación activa de ruido, audio espacial personalizado y estuche de carga MagSafe.',
  '11111111-1111-1111-1111-111111111114',
  'Apple',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  3500.00, 5999.00, 5500.00, NULL, false,
  45, 15, 100, 'unidad', '7501234567895',
  ARRAY['https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800'],
  0.056, '6.05 x 4.54 x 2.13 cm', 'Estante C1', ARRAY['audifonos', 'apple', 'bluetooth'], true, true
),

-- =====================================================
-- PRODUCTOS - ROPA Y ACCESORIOS
-- =====================================================

(
  '20000000-0000-0000-0000-000000000001',
  'CAMISETA-NIKE-M',
  'Camiseta Nike Dri-FIT Talla M',
  'Camiseta deportiva Nike con tecnología Dri-FIT para mantener la piel seca y cómoda.',
  '22222222-2222-2222-2222-222222222223',
  'Nike',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  250.00, 599.00, 550.00, 499.00, true,
  120, 30, 200, 'unidad', '7501234567896',
  ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
  0.15, '70 x 50 x 2 cm', 'Estante D1', ARRAY['ropa', 'deportiva', 'nike'], true, false
),
(
  '20000000-0000-0000-0000-000000000002',
  'JEANS-LEVIS-501-32',
  'Jeans Levi''s 501 Original Talla 32',
  'Jeans clásicos Levi''s 501 Original Fit, el jean icónico desde 1873.',
  '22222222-2222-2222-2222-222222222224',
  'Levi''s',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  600.00, 1299.00, 1200.00, NULL, false,
  65, 20, 150, 'unidad', '7501234567897',
  ARRAY['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
  0.65, '40 x 30 x 5 cm', 'Estante D2', ARRAY['jeans', 'levis', 'clasico'], true, true
),
(
  '20000000-0000-0000-0000-000000000003',
  'TENIS-ADIDAS-42',
  'Tenis Adidas Ultraboost 22 Talla 42',
  'Tenis para correr Adidas Ultraboost 22 con tecnología BOOST para máxima comodidad.',
  '22222222-2222-2222-2222-222222222225',
  'Adidas',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  1200.00, 2499.00, 2300.00, 2199.00, true,
  35, 10, 80, 'par', '7501234567898',
  ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'],
  0.85, '32 x 20 x 12 cm', 'Estante E1', ARRAY['tenis', 'adidas', 'running'], true, true
),

-- =====================================================
-- PRODUCTOS - HOGAR Y JARDÍN
-- =====================================================

(
  '30000000-0000-0000-0000-000000000001',
  'LICUADORA-OSTER-1200W',
  'Licuadora Oster 1200W 3 Velocidades',
  'Licuadora Oster con motor de 1200W, vaso de vidrio de 1.5L y 3 velocidades.',
  '33333333-3333-3333-3333-333333333333',
  'Oster',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  800.00, 1599.00, 1450.00, NULL, false,
  25, 8, 50, 'unidad', '7501234567899',
  ARRAY['https://images.unsplash.com/photo-1585515320310-259814833e62?w=800'],
  3.2, '20 x 20 x 40 cm', 'Estante F1', ARRAY['electrodomestico', 'cocina', 'oster'], true, false
),
(
  '30000000-0000-0000-0000-000000000002',
  'JUEGO-SARTENES-5PZ',
  'Juego de Sartenes Antiadherentes 5 Piezas',
  'Set de 5 sartenes con recubrimiento antiadherente de cerámica, libre de PFOA.',
  '33333333-3333-3333-3333-333333333333',
  'T-fal',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  600.00, 1299.00, 1150.00, 999.00, true,
  18, 5, 40, 'juego', '7501234567900',
  ARRAY['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800'],
  4.5, '35 x 35 x 15 cm', 'Estante F2', ARRAY['cocina', 'sartenes', 'antiadherente'], true, false
),

-- =====================================================
-- PRODUCTOS - DEPORTES
-- =====================================================

(
  '40000000-0000-0000-0000-000000000001',
  'BALON-FUTBOL-NIKE-5',
  'Balón de Fútbol Nike Strike Talla 5',
  'Balón de fútbol Nike Strike con gráficos de alto contraste para mejor visibilidad.',
  '44444444-4444-4444-4444-444444444444',
  'Nike',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  300.00, 699.00, 650.00, NULL, false,
  50, 15, 100, 'unidad', '7501234567901',
  ARRAY['https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=800'],
  0.42, '22 x 22 x 22 cm', 'Estante G1', ARRAY['futbol', 'balon', 'nike'], true, false
),
(
  '40000000-0000-0000-0000-000000000002',
  'MANCUERNAS-10KG-PAR',
  'Mancuernas Hexagonales 10kg (Par)',
  'Par de mancuernas hexagonales de 10kg cada una, recubiertas de goma para proteger el piso.',
  '44444444-4444-4444-4444-444444444444',
  'Rogue',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  800.00, 1599.00, 1450.00, 1399.00, true,
  12, 4, 30, 'par', '7501234567902',
  ARRAY['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800'],
  20.0, '15 x 15 x 30 cm', 'Estante G2', ARRAY['pesas', 'gym', 'fitness'], true, true
),

-- =====================================================
-- PRODUCTOS - ALIMENTOS (Stock bajo para testing)
-- =====================================================

(
  '50000000-0000-0000-0000-000000000001',
  'CAFE-ARABICA-1KG',
  'Café Arábica Premium 1kg',
  'Café 100% arábica de altura, tostado medio, notas de chocolate y caramelo.',
  '55555555-5555-5555-5555-555555555555',
  'Café del Valle',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  180.00, 399.00, 370.00, NULL, false,
  8, 20, 100, 'kg', '7501234567903',
  ARRAY['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800'],
  1.0, '20 x 10 x 5 cm', 'Estante H1', ARRAY['cafe', 'organico', 'premium'], true, false
),
(
  '50000000-0000-0000-0000-000000000002',
  'ACEITE-OLIVA-500ML',
  'Aceite de Oliva Extra Virgen 500ml',
  'Aceite de oliva extra virgen prensado en frío, ideal para ensaladas y cocina.',
  '55555555-5555-5555-5555-555555555555',
  'La Española',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  120.00, 249.00, 230.00, 199.00, true,
  3, 15, 80, 'unidad', '7501234567904',
  ARRAY['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800'],
  0.5, '7 x 7 x 25 cm', 'Estante H2', ARRAY['aceite', 'oliva', 'cocina'], true, false
),

-- Producto sin stock (para testing)
(
  '50000000-0000-0000-0000-000000000003',
  'MIEL-ORGANICA-500G',
  'Miel de Abeja Orgánica 500g',
  'Miel 100% pura de abeja, certificada orgánica, sin aditivos ni conservadores.',
  '55555555-5555-5555-5555-555555555555',
  'Miel del Campo',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  150.00, 299.00, 280.00, NULL, false,
  0, 10, 60, 'unidad', '7501234567905',
  ARRAY['https://images.unsplash.com/photo-1587049352846-4a222e784acc?w=800'],
  0.5, '8 x 8 x 12 cm', 'Estante H3', ARRAY['miel', 'organica', 'natural'], true, false
);

-- =====================================================
-- MOVIMIENTOS DE INVENTARIO (Historial)
-- =====================================================

INSERT INTO product_movements (
  product_id, movement_type, quantity, previous_stock, new_stock,
  unit_cost, total_cost, notes, created_at
) VALUES
-- Entrada inicial de iPhone
(
  '10000000-0000-0000-0000-000000000001',
  'entrada',
  20,
  0,
  20,
  18000.00,
  360000.00,
  'Compra inicial de inventario',
  NOW() - INTERVAL '30 days'
),
-- Venta de iPhone
(
  '10000000-0000-0000-0000-000000000001',
  'venta',
  5,
  20,
  15,
  18000.00,
  90000.00,
  'Venta a cliente',
  NOW() - INTERVAL '15 days'
),
-- Entrada de Samsung
(
  '10000000-0000-0000-0000-000000000002',
  'entrada',
  30,
  0,
  30,
  14000.00,
  420000.00,
  'Compra inicial de inventario',
  NOW() - INTERVAL '25 days'
),
-- Venta de Samsung
(
  '10000000-0000-0000-0000-000000000002',
  'venta',
  8,
  30,
  22,
  14000.00,
  112000.00,
  'Venta a cliente',
  NOW() - INTERVAL '10 days'
);

-- =====================================================
-- HISTORIAL DE PRECIOS
-- =====================================================

INSERT INTO product_price_history (
  product_id, price_type, old_price, new_price, change_reason, created_at
) VALUES
-- Cambio de precio en Samsung (oferta)
(
  '10000000-0000-0000-0000-000000000002',
  'sale',
  19999.00,
  17999.00,
  'Promoción de temporada',
  NOW() - INTERVAL '7 days'
),
-- Cambio de precio en Dell
(
  '10000000-0000-0000-0000-000000000005',
  'sale',
  26999.00,
  25999.00,
  'Ajuste de precio por competencia',
  NOW() - INTERVAL '14 days'
);

-- =====================================================
-- ESTADÍSTICAS FINALES
-- =====================================================

-- Mostrar resumen de datos insertados
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
  RAISE NOTICE 'DATOS DE EJEMPLO INSERTADOS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorías: %', cat_count;
  RAISE NOTICE 'Proveedores: %', sup_count;
  RAISE NOTICE 'Productos: %', prod_count;
  RAISE NOTICE 'Movimientos: %', mov_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN DEL SCRIPT DE DATOS
-- =====================================================
