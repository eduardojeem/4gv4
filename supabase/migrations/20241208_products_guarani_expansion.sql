-- =====================================================
-- SCRIPT: Expansión de Productos con Precios en Guaraníes
-- Fecha: 2024-12-08
-- Descripción: Actualiza productos existentes y agrega nuevos con precios en Gs
-- Tasa de cambio aproximada: 1 USD = 7,300 Gs
-- =====================================================

-- =====================================================
-- PARTE 1: ACTUALIZAR PRECIOS EXISTENTES A GUARANÍES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ACTUALIZANDO PRECIOS A GUARANÍES';
  RAISE NOTICE '========================================';
END $$;

-- Actualizar productos existentes (multiplicar por 7,300)
UPDATE products 
SET 
  purchase_price = purchase_price * 7300,
  sale_price = sale_price * 7300,
  wholesale_price = CASE WHEN wholesale_price IS NOT NULL THEN wholesale_price * 7300 ELSE NULL END,
  offer_price = CASE WHEN offer_price IS NOT NULL THEN offer_price * 7300 ELSE NULL END
WHERE purchase_price < 10000; -- Solo actualizar si aún no están en guaraníes

-- =====================================================
-- PARTE 2: AGREGAR NUEVOS PRODUCTOS TECNOLÓGICOS
-- =====================================================

DO $$
DECLARE
  cat_smartphones UUID;
  cat_laptops UUID;
  cat_accesorios UUID;
  cat_tablets UUID;
  supplier_tech UUID;
BEGIN
  -- Obtener IDs de categorías
  SELECT id INTO cat_smartphones FROM categories WHERE name = 'Smartphones' LIMIT 1;
  SELECT id INTO cat_laptops FROM categories WHERE name = 'Laptops' LIMIT 1;
  SELECT id INTO cat_accesorios FROM categories WHERE name = 'Accesorios Tech' LIMIT 1;
  SELECT id INTO cat_tablets FROM categories WHERE name = 'Electrónica' LIMIT 1;
  
  -- Obtener proveedor
  SELECT id INTO supplier_tech FROM suppliers WHERE name LIKE '%Tech%' LIMIT 1;
  
  -- Si no existen las categorías, usar la primera disponible
  IF cat_smartphones IS NULL THEN
    SELECT id INTO cat_smartphones FROM categories LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Insertando nuevos productos...';
  
  -- =====================================================
  -- SMARTPHONES
  -- =====================================================
  
  INSERT INTO products (sku, name, description, category_id, brand, supplier_id, purchase_price, sale_price, wholesale_price, stock_quantity, min_stock, barcode, is_active, featured) VALUES
  
  -- Samsung Galaxy
  ('SAMSUNG-A54-128', 'Samsung Galaxy A54 5G 128GB', 'Pantalla AMOLED 6.4", Cámara 50MP, Batería 5000mAh', cat_smartphones, 'Samsung', supplier_tech, 2190000, 2920000, 2700000, 15, 3, '8806094937350', true, true),
  ('SAMSUNG-S23-256', 'Samsung Galaxy S23 256GB', 'Snapdragon 8 Gen 2, Pantalla 6.1" Dynamic AMOLED', cat_smartphones, 'Samsung', supplier_tech, 5840000, 7300000, 6900000, 8, 2, '8806094937367', true, true),
  ('SAMSUNG-A34-128', 'Samsung Galaxy A34 5G 128GB', 'Pantalla Super AMOLED 6.6", Cámara 48MP', cat_smartphones, 'Samsung', supplier_tech, 1825000, 2555000, 2400000, 20, 5, '8806094937374', true, false),
  
  -- Xiaomi
  ('XIAOMI-13T-256', 'Xiaomi 13T 256GB', 'MediaTek Dimensity 8200, Cámara Leica 50MP', cat_smartphones, 'Xiaomi', supplier_tech, 2920000, 3650000, 3400000, 12, 3, '6941812745892', true, true),
  ('XIAOMI-REDMI-12', 'Xiaomi Redmi 12 128GB', 'Pantalla 6.79" FHD+, Batería 5000mAh', cat_smartphones, 'Xiaomi', supplier_tech, 1095000, 1460000, 1350000, 25, 5, '6941812745908', true, false),
  ('XIAOMI-POCO-X5', 'Xiaomi POCO X5 Pro 256GB', 'Snapdragon 778G, Pantalla AMOLED 120Hz', cat_smartphones, 'Xiaomi', supplier_tech, 2190000, 2920000, 2700000, 10, 3, '6941812745915', true, true),
  
  -- Motorola
  ('MOTO-G84-256', 'Motorola Moto G84 5G 256GB', 'Snapdragon 695, Pantalla pOLED 120Hz', cat_smartphones, 'Motorola', supplier_tech, 1825000, 2555000, 2400000, 15, 3, '840023234567', true, false),
  ('MOTO-EDGE-40', 'Motorola Edge 40 256GB', 'MediaTek Dimensity 8020, Cámara 50MP', cat_smartphones, 'Motorola', supplier_tech, 2920000, 3650000, 3400000, 8, 2, '840023234574', true, true),
  
  -- iPhone
  ('IPHONE-14-128', 'iPhone 14 128GB', 'A15 Bionic, Pantalla 6.1" Super Retina XDR', cat_smartphones, 'Apple', supplier_tech, 5840000, 7300000, 6900000, 5, 2, '194253404477', true, true),
  ('IPHONE-13-128', 'iPhone 13 128GB', 'A15 Bionic, Dual Camera 12MP', cat_smartphones, 'Apple', supplier_tech, 4380000, 5840000, 5500000, 8, 2, '194252707050', true, true),
  ('IPHONE-SE-64', 'iPhone SE 2022 64GB', 'A15 Bionic, Touch ID, Pantalla 4.7"', cat_smartphones, 'Apple', supplier_tech, 2920000, 3650000, 3400000, 10, 3, '194252706954', true, false)
  ON CONFLICT (sku) DO UPDATE SET
    purchase_price = EXCLUDED.purchase_price,
    sale_price = EXCLUDED.sale_price,
    wholesale_price = EXCLUDED.wholesale_price,
    stock_quantity = products.stock_quantity + EXCLUDED.stock_quantity;
  
  RAISE NOTICE '✓ Smartphones insertados/actualizados';
  
  -- =====================================================
  -- LAPTOPS
  -- =====================================================
  
  INSERT INTO products (sku, name, description, category_id, brand, supplier_id, purchase_price, sale_price, wholesale_price, stock_quantity, min_stock, barcode, is_active, featured) VALUES
  
  -- Dell
  ('DELL-INSPIRON-15', 'Dell Inspiron 15 3520', 'Intel i5-1235U, 8GB RAM, 512GB SSD, 15.6" FHD', cat_laptops, 'Dell', supplier_tech, 3650000, 4745000, 4380000, 10, 2, '884116404477', true, true),
  ('DELL-LATITUDE-14', 'Dell Latitude 3420', 'Intel i7-1165G7, 16GB RAM, 512GB SSD, 14" FHD', cat_laptops, 'Dell', supplier_tech, 5840000, 7300000, 6900000, 5, 1, '884116404484', true, true),
  
  -- HP
  ('HP-PAVILION-15', 'HP Pavilion 15-eh2000', 'AMD Ryzen 5 5625U, 8GB RAM, 512GB SSD', cat_laptops, 'HP', supplier_tech, 3650000, 4745000, 4380000, 8, 2, '196337404477', true, false),
  ('HP-PROBOOK-440', 'HP ProBook 440 G9', 'Intel i5-1235U, 16GB RAM, 512GB SSD, 14"', cat_laptops, 'HP', supplier_tech, 5110000, 6570000, 6200000, 6, 1, '196337404484', true, true),
  
  -- Lenovo
  ('LENOVO-IDEAPAD-3', 'Lenovo IdeaPad 3 15ITL6', 'Intel i5-1135G7, 8GB RAM, 512GB SSD', cat_laptops, 'Lenovo', supplier_tech, 3285000, 4380000, 4100000, 12, 2, '195348404477', true, false),
  ('LENOVO-THINKPAD-E14', 'Lenovo ThinkPad E14 Gen 4', 'Intel i7-1255U, 16GB RAM, 512GB SSD', cat_laptops, 'Lenovo', supplier_tech, 5840000, 7300000, 6900000, 5, 1, '195348404484', true, true),
  
  -- Asus
  ('ASUS-VIVOBOOK-15', 'Asus VivoBook 15 X1502ZA', 'Intel i5-1235U, 8GB RAM, 512GB SSD', cat_laptops, 'Asus', supplier_tech, 3650000, 4745000, 4380000, 10, 2, '195553404477', true, false),
  ('ASUS-ZENBOOK-14', 'Asus ZenBook 14 OLED', 'Intel i7-1260P, 16GB RAM, 512GB SSD, OLED', cat_laptops, 'Asus', supplier_tech, 6570000, 8030000, 7600000, 4, 1, '195553404484', true, true),
  
  -- MacBook
  ('MACBOOK-AIR-M1', 'MacBook Air M1 256GB', 'Apple M1, 8GB RAM, 256GB SSD, 13.3" Retina', cat_laptops, 'Apple', supplier_tech, 7300000, 9125000, 8600000, 3, 1, '194252515563', true, true),
  ('MACBOOK-PRO-M2', 'MacBook Pro M2 512GB', 'Apple M2, 8GB RAM, 512GB SSD, 13.6" Liquid Retina', cat_laptops, 'Apple', supplier_tech, 10220000, 12775000, 12000000, 2, 1, '194253404484', true, true)
  ON CONFLICT (sku) DO UPDATE SET
    purchase_price = EXCLUDED.purchase_price,
    sale_price = EXCLUDED.sale_price,
    wholesale_price = EXCLUDED.wholesale_price,
    stock_quantity = products.stock_quantity + EXCLUDED.stock_quantity;
  
  RAISE NOTICE '✓ Laptops insertadas/actualizadas';
  
  -- =====================================================
  -- TABLETS
  -- =====================================================
  
  INSERT INTO products (sku, name, description, category_id, brand, supplier_id, purchase_price, sale_price, wholesale_price, stock_quantity, min_stock, barcode, is_active, featured) VALUES
  
  ('IPAD-9-64', 'iPad 9th Gen 64GB', 'A13 Bionic, Pantalla 10.2" Retina', cat_tablets, 'Apple', supplier_tech, 2555000, 3285000, 3100000, 8, 2, '194252515570', true, true),
  ('IPAD-AIR-64', 'iPad Air 5th Gen 64GB', 'M1 Chip, Pantalla 10.9" Liquid Retina', cat_tablets, 'Apple', supplier_tech, 4380000, 5840000, 5500000, 5, 1, '194252515587', true, true),
  ('SAMSUNG-TAB-S8', 'Samsung Galaxy Tab S8 128GB', 'Snapdragon 8 Gen 1, Pantalla 11" LTPS', cat_tablets, 'Samsung', supplier_tech, 3650000, 4745000, 4380000, 10, 2, '8806094404477', true, true),
  ('SAMSUNG-TAB-A8', 'Samsung Galaxy Tab A8 64GB', 'Unisoc Tiger T618, Pantalla 10.5" TFT', cat_tablets, 'Samsung', supplier_tech, 1460000, 2190000, 2000000, 15, 3, '8806094404484', true, false),
  ('XIAOMI-PAD-6', 'Xiaomi Pad 6 128GB', 'Snapdragon 870, Pantalla 11" 144Hz', cat_tablets, 'Xiaomi', supplier_tech, 2190000, 2920000, 2700000, 12, 3, '6941812404477', true, true)
  ON CONFLICT (sku) DO UPDATE SET
    purchase_price = EXCLUDED.purchase_price,
    sale_price = EXCLUDED.sale_price,
    wholesale_price = EXCLUDED.wholesale_price,
    stock_quantity = products.stock_quantity + EXCLUDED.stock_quantity;
  
  RAISE NOTICE '✓ Tablets insertadas/actualizadas';
  
  -- =====================================================
  -- ACCESORIOS
  -- =====================================================
  
  INSERT INTO products (sku, name, description, category_id, brand, supplier_id, purchase_price, sale_price, wholesale_price, stock_quantity, min_stock, barcode, is_active, featured) VALUES
  
  -- Auriculares
  ('AIRPODS-PRO-2', 'Apple AirPods Pro 2nd Gen', 'Cancelación de ruido activa, USB-C', cat_accesorios, 'Apple', supplier_tech, 1825000, 2555000, 2400000, 15, 3, '194253404491', true, true),
  ('AIRPODS-3', 'Apple AirPods 3rd Gen', 'Audio espacial, Resistente al agua', cat_accesorios, 'Apple', supplier_tech, 1460000, 2190000, 2000000, 20, 5, '194252515594', true, false),
  ('SAMSUNG-BUDS-2', 'Samsung Galaxy Buds 2 Pro', 'ANC, Audio 360, Resistente al agua', cat_accesorios, 'Samsung', supplier_tech, 1095000, 1460000, 1350000, 25, 5, '8806094404491', true, true),
  ('XIAOMI-BUDS-4', 'Xiaomi Buds 4 Pro', 'ANC adaptativa, LHDC 5.0', cat_accesorios, 'Xiaomi', supplier_tech, 730000, 1095000, 1000000, 30, 5, '6941812404484', true, false),
  
  -- Cargadores y Cables
  ('ANKER-CHARGER-65W', 'Anker PowerPort III 65W', 'Cargador rápido USB-C PD 3.0', cat_accesorios, 'Anker', supplier_tech, 219000, 365000, 330000, 40, 10, '194644404477', true, false),
  ('APPLE-CABLE-USBC', 'Apple Cable USB-C 2m', 'Cable trenzado USB-C a USB-C', cat_accesorios, 'Apple', supplier_tech, 146000, 219000, 200000, 50, 10, '194253404498', true, false),
  ('SAMSUNG-CHARGER-45W', 'Samsung Cargador Super Fast 45W', 'Cargador rápido USB-C PD', cat_accesorios, 'Samsung', supplier_tech, 219000, 365000, 330000, 35, 10, '8806094404498', true, false),
  
  -- Protectores y Cases
  ('SPIGEN-CASE-S23', 'Spigen Case para Galaxy S23', 'Case resistente con protección militar', cat_accesorios, 'Spigen', supplier_tech, 73000, 146000, 120000, 50, 10, '8809896404477', true, false),
  ('OTTERBOX-IPHONE14', 'OtterBox Defender iPhone 14', 'Protección extrema con clip de cinturón', cat_accesorios, 'OtterBox', supplier_tech, 219000, 365000, 330000, 30, 5, '660543404477', true, false),
  ('TEMPERED-GLASS', 'Vidrio Templado Universal', 'Protector de pantalla 9H, varios modelos', cat_accesorios, 'Genérico', supplier_tech, 36500, 73000, 60000, 100, 20, '7501234567897', true, false),
  
  -- Memorias y Almacenamiento
  ('SANDISK-128GB', 'SanDisk Ultra microSD 128GB', 'Clase 10, UHS-I, hasta 120MB/s', cat_accesorios, 'SanDisk', supplier_tech, 109500, 182500, 160000, 60, 15, '619659404477', true, false),
  ('SAMSUNG-256GB', 'Samsung EVO Plus microSD 256GB', 'Clase 10, UHS-I, hasta 130MB/s', cat_accesorios, 'Samsung', supplier_tech, 219000, 365000, 330000, 40, 10, '8806094404505', true, true),
  ('KINGSTON-64GB', 'Kingston Canvas Select Plus 64GB', 'Clase 10, UHS-I, hasta 100MB/s', cat_accesorios, 'Kingston', supplier_tech, 73000, 146000, 120000, 80, 20, '740617404477', true, false)
  ON CONFLICT (sku) DO UPDATE SET
    purchase_price = EXCLUDED.purchase_price,
    sale_price = EXCLUDED.sale_price,
    wholesale_price = EXCLUDED.wholesale_price,
    stock_quantity = products.stock_quantity + EXCLUDED.stock_quantity;
  
  RAISE NOTICE '✓ Accesorios insertados/actualizados';
  
END $$;

-- =====================================================
-- PARTE 3: ACTUALIZAR MOVIMIENTOS DE STOCK
-- =====================================================

-- Actualizar costos en movimientos existentes
UPDATE product_movements 
SET 
  unit_cost = unit_cost * 7300,
  total_cost = total_cost * 7300
WHERE unit_cost IS NOT NULL AND unit_cost < 10000;

-- =====================================================
-- PARTE 4: ACTUALIZAR HISTORIAL DE PRECIOS
-- =====================================================

-- Actualizar historial de precios
UPDATE product_price_history 
SET 
  old_price = CASE WHEN old_price IS NOT NULL THEN old_price * 7300 ELSE NULL END,
  new_price = new_price * 7300
WHERE new_price < 10000;

-- =====================================================
-- PARTE 5: VERIFICACIÓN FINAL
-- =====================================================

DO $$
DECLARE
  total_products INTEGER;
  new_products INTEGER;
  avg_price NUMERIC;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO total_products FROM products WHERE is_active = true;
  SELECT COUNT(*) INTO new_products FROM products WHERE created_at > NOW() - INTERVAL '1 minute';
  SELECT AVG(sale_price) INTO avg_price FROM products WHERE is_active = true;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓✓✓ ACTUALIZACIÓN COMPLETADA ✓✓✓';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de productos activos: %', total_products;
  RAISE NOTICE 'Productos nuevos agregados: %', new_products;
  RAISE NOTICE 'Precio promedio de venta: Gs %', ROUND(avg_price);
  RAISE NOTICE '';
  RAISE NOTICE 'Distribución por categoría:';
  
  FOR rec IN 
    SELECT c.name, COUNT(p.id) as cantidad
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
    GROUP BY c.name
    ORDER BY cantidad DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  - %: % productos', rec.name, rec.cantidad;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Top 5 productos más caros:';
  
  FOR rec IN 
    SELECT name, sale_price
    FROM products
    WHERE is_active = true
    ORDER BY sale_price DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '  - %: Gs %', rec.name, ROUND(rec.sale_price);
  END LOOP;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
