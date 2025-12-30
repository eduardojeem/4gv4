-- =============================================
-- SEED DE DATOS DE EJEMPLO PARA PRODUCTOS
-- Ejecuta este script en el SQL Editor de Supabase
-- =============================================

-- Categorías
INSERT INTO categories (id, name, description, parent_id, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Smartphones', 'Teléfonos inteligentes y dispositivos móviles', NULL, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Accesorios', 'Accesorios para dispositivos móviles', NULL, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Repuestos', 'Repuestos y componentes para reparaciones', NULL, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Tablets', 'Tabletas y dispositivos de pantalla grande', NULL, TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Proveedores
INSERT INTO suppliers (id, name, contact_person, email, phone, address, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'TechCorp Solutions', 'Carlos Pérez', 'contact@techcorp.com', '+56 9 1234 5678', 'Av. Tecnología 123, Santiago', 'active', NOW(), NOW()),
  (gen_random_uuid(), 'Apple Inc.', 'John Smith', 'orders@apple.com', '+1-800-APL-CARE', 'One Apple Park Way, Cupertino, CA', 'active', NOW(), NOW()),
  (gen_random_uuid(), 'Samsung', 'Maria Garcia', 'b2b@samsung.com', '+1-800-SAMSUNG', '1301 E Lookout Dr, Richardson, TX', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Marcas

-- Productos (usando categorías y proveedores existentes por nombre)
WITH cat_smartphones AS (
  SELECT id FROM categories WHERE name = 'Smartphones' LIMIT 1
), cat_accessories AS (
  SELECT id FROM categories WHERE name = 'Accesorios' LIMIT 1
), sup_apple AS (
  SELECT id FROM suppliers WHERE name = 'Apple Inc.' LIMIT 1
), sup_samsung AS (
  SELECT id FROM suppliers WHERE name = 'Samsung' LIMIT 1
)
INSERT INTO products (
  id, sku, name, description, category_id, brand, supplier_id,
  purchase_price, sale_price, wholesale_price,
  stock_quantity, min_stock, unit_measure,
  is_active, images, location, barcode, weight, dimensions, tags, featured, currency,
  created_at, updated_at
)
VALUES
  (
    gen_random_uuid(), 'IPH15PRO001', 'iPhone 15 Pro', 'Smartphone Apple iPhone 15 Pro 128GB',
    (SELECT id FROM cat_smartphones), 'Apple', (SELECT id FROM sup_apple),
    999000, 1299000, NULL,
    15, 5, 'unidad',
    TRUE, NULL, NULL, '194253000000', NULL, NULL, ARRAY['smartphone','apple'], TRUE, 'PYG',
    NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'SMG-S24U-001', 'Samsung Galaxy S24 Ultra', 'Smartphone Samsung Galaxy S24 Ultra 256GB',
    (SELECT id FROM cat_smartphones), 'Samsung', (SELECT id FROM sup_samsung),
    799000, 1099000, NULL,
    20, 5, 'unidad',
    TRUE, NULL, NULL, '8806090000000', NULL, NULL, ARRAY['smartphone','samsung'], TRUE, 'PYG',
    NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'ACC-USB-C-001', 'Cargador USB-C 30W', 'Cargador rápido USB-C 30W',
    (SELECT id FROM cat_accessories), 'TechCorp', (SELECT id FROM sup_samsung),
    9900, 19900, NULL,
    100, 20, 'unidad',
    TRUE, NULL, NULL, NULL, NULL, NULL, ARRAY['accesorio','cargador'], FALSE, 'PYG',
    NOW(), NOW()
  )
ON CONFLICT DO NOTHING;

-- Movimientos de stock para el iPhone 15 Pro
WITH p AS (
  SELECT id, stock_quantity FROM products WHERE sku = 'IPH15PRO001' LIMIT 1
)
INSERT INTO product_movements (
  id, product_id, movement_type, quantity, previous_stock, new_stock,
  unit_cost, reason, reference_id, reference_type, user_id, created_at
)
VALUES
  (
    gen_random_uuid(), (SELECT id FROM p), 'in', 10, (SELECT stock_quantity FROM p), (SELECT stock_quantity FROM p) + 10,
    999000, 'Compra inicial', NULL, 'purchase_order', NULL, NOW()
  ),
  (
    gen_random_uuid(), (SELECT id FROM p), 'out', 2, (SELECT stock_quantity FROM p) + 10, (SELECT stock_quantity FROM p) + 8,
    1299000, 'Venta mostrador', NULL, 'sale', NULL, NOW()
  )
ON CONFLICT DO NOTHING;

-- Historial de precios para el iPhone 15 Pro
WITH p AS (
  SELECT id FROM products WHERE sku = 'IPH15PRO001' LIMIT 1
)
INSERT INTO product_price_history (id, product_id, price_type, old_price, new_price, change_reason, user_id, currency, created_at)
VALUES 
  (gen_random_uuid(), (SELECT id FROM p), 'purchase', 999000, 949000, 'Ajuste de costos por campaña', NULL, 'PYG', NOW()),
  (gen_random_uuid(), (SELECT id FROM p), 'sale', 1299000, 1249000, 'Descuento promocional', NULL, 'PYG', NOW())
ON CONFLICT DO NOTHING;

-- Alertas de inventario
WITH p AS (
  SELECT id FROM products WHERE sku = 'ACC-USB-C-001' LIMIT 1
)
INSERT INTO product_alerts (id, product_id, type, message, is_resolved, resolved_at, created_at)
VALUES
  (
    gen_random_uuid(), (SELECT id FROM p), 'low_stock', 'Stock bajo para Cargador USB-C 30W', FALSE, NULL, NOW()
  )
ON CONFLICT DO NOTHING;
