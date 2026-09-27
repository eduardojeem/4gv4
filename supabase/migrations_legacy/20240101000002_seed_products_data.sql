-- Insertar categorías de ejemplo
INSERT INTO categories (name, description, color, icon) VALUES
('Pantallas', 'Pantallas y displays para dispositivos móviles', '#3B82F6', 'Monitor'),
('Baterías', 'Baterías y componentes de energía', '#10B981', 'Battery'),
('Cargadores', 'Cargadores y cables de alimentación', '#F59E0B', 'Zap'),
('Carcasas', 'Carcasas y protectores', '#8B5CF6', 'Shield'),
('Componentes', 'Componentes internos y repuestos', '#EF4444', 'Cpu'),
('Herramientas', 'Herramientas de reparación', '#6B7280', 'Wrench'),
('Accesorios', 'Accesorios y complementos', '#EC4899', 'Headphones'),
('Servicios', 'Servicios de reparación', '#14B8A6', 'Settings');

-- Insertar proveedores de ejemplo
INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id, payment_terms) VALUES
('TechParts Global', 'María González', 'maria@techparts.com', '+1-555-0101', '123 Tech Street, Miami, FL', '12345678901', 30),
('Mobile Components Inc', 'Carlos Rodríguez', 'carlos@mobilecomp.com', '+1-555-0102', '456 Mobile Ave, Houston, TX', '12345678902', 15),
('RepairPro Supplies', 'Ana Martínez', 'ana@repairpro.com', '+1-555-0103', '789 Repair Blvd, Los Angeles, CA', '12345678903', 45),
('Digital Parts Co', 'Luis Fernández', 'luis@digitalparts.com', '+1-555-0104', '321 Digital Way, New York, NY', '12345678904', 30),
('SmartFix Distribution', 'Carmen López', 'carmen@smartfix.com', '+1-555-0105', '654 Smart Lane, Chicago, IL', '12345678905', 20);

-- Insertar productos de ejemplo
INSERT INTO products (sku, name, description, category_id, brand, supplier_id, purchase_price, sale_price, wholesale_price, stock, min_stock, unit_measure, barcode, location, warranty_months, tags) VALUES
-- Pantallas
('PNT-SAM-A10-001', 'Pantalla Samsung Galaxy A10', 'Pantalla LCD completa con touch para Samsung Galaxy A10', (SELECT id FROM categories WHERE name = 'Pantallas'), 'Samsung', (SELECT id FROM suppliers WHERE name = 'TechParts Global'), 25.00, 45.00, 35.00, 15, 5, 'unidad', '1234567890123', 'A1-B2', 3, ARRAY['samsung', 'a10', 'lcd', 'touch']),
('PNT-IPH-12-001', 'Pantalla iPhone 12', 'Pantalla OLED original para iPhone 12', (SELECT id FROM categories WHERE name = 'Pantallas'), 'Apple', (SELECT id FROM suppliers WHERE name = 'Mobile Components Inc'), 120.00, 200.00, 160.00, 8, 3, 'unidad', '1234567890124', 'A1-B3', 6, ARRAY['iphone', '12', 'oled', 'original']),
('PNT-XIA-RN9-001', 'Pantalla Xiaomi Redmi Note 9', 'Pantalla IPS con marco para Xiaomi Redmi Note 9', (SELECT id FROM categories WHERE name = 'Pantallas'), 'Xiaomi', (SELECT id FROM suppliers WHERE name = 'RepairPro Supplies'), 18.00, 32.00, 25.00, 22, 8, 'unidad', '1234567890125', 'A1-B4', 3, ARRAY['xiaomi', 'redmi', 'note9', 'ips']),

-- Baterías
('BAT-SAM-A10-001', 'Batería Samsung Galaxy A10', 'Batería Li-ion 3400mAh para Samsung Galaxy A10', (SELECT id FROM categories WHERE name = 'Baterías'), 'Samsung', (SELECT id FROM suppliers WHERE name = 'TechParts Global'), 8.00, 15.00, 12.00, 25, 10, 'unidad', '1234567890126', 'B1-A2', 6, ARRAY['samsung', 'a10', 'bateria', '3400mah']),
('BAT-IPH-12-001', 'Batería iPhone 12', 'Batería Li-ion 2815mAh original para iPhone 12', (SELECT id FROM categories WHERE name = 'Baterías'), 'Apple', (SELECT id FROM suppliers WHERE name = 'Mobile Components Inc'), 35.00, 60.00, 48.00, 12, 5, 'unidad', '1234567890127', 'B1-A3', 12, ARRAY['iphone', '12', 'bateria', '2815mah', 'original']),
('BAT-XIA-RN9-001', 'Batería Xiaomi Redmi Note 9', 'Batería Li-Po 5020mAh para Xiaomi Redmi Note 9', (SELECT id FROM categories WHERE name = 'Baterías'), 'Xiaomi', (SELECT id FROM suppliers WHERE name = 'RepairPro Supplies'), 12.00, 22.00, 18.00, 18, 8, 'unidad', '1234567890128', 'B1-A4', 6, ARRAY['xiaomi', 'redmi', 'note9', 'bateria', '5020mah']),

-- Cargadores
('CAR-USB-C-001', 'Cargador USB-C 20W', 'Cargador rápido USB-C de 20W universal', (SELECT id FROM categories WHERE name = 'Cargadores'), 'Universal', (SELECT id FROM suppliers WHERE name = 'Digital Parts Co'), 5.00, 12.00, 9.00, 50, 15, 'unidad', '1234567890129', 'C1-A1', 12, ARRAY['usb-c', 'cargador', '20w', 'rapido']),
('CAR-LIGHT-001', 'Cable Lightning 1m', 'Cable Lightning certificado MFi de 1 metro', (SELECT id FROM categories WHERE name = 'Cargadores'), 'Apple', (SELECT id FROM suppliers WHERE name = 'Mobile Components Inc'), 8.00, 18.00, 14.00, 30, 10, 'unidad', '1234567890130', 'C1-A2', 24, ARRAY['lightning', 'cable', 'mfi', '1metro']),
('CAR-MICRO-001', 'Cable Micro USB 1.5m', 'Cable Micro USB de carga y datos de 1.5 metros', (SELECT id FROM categories WHERE name = 'Cargadores'), 'Universal', (SELECT id FROM suppliers WHERE name = 'SmartFix Distribution'), 3.00, 8.00, 6.00, 40, 20, 'unidad', '1234567890131', 'C1-A3', 12, ARRAY['micro-usb', 'cable', 'datos', '1.5metro']),

-- Carcasas
('CAR-SAM-A10-001', 'Carcasa Samsung Galaxy A10', 'Carcasa trasera original para Samsung Galaxy A10', (SELECT id FROM categories WHERE name = 'Carcasas'), 'Samsung', (SELECT id FROM suppliers WHERE name = 'TechParts Global'), 6.00, 12.00, 9.00, 20, 8, 'unidad', '1234567890132', 'D1-A1', 3, ARRAY['samsung', 'a10', 'carcasa', 'trasera']),
('CAR-IPH-12-001', 'Carcasa iPhone 12', 'Carcasa trasera con cristal para iPhone 12', (SELECT id FROM categories WHERE name = 'Carcasas'), 'Apple', (SELECT id FROM suppliers WHERE name = 'Mobile Components Inc'), 25.00, 45.00, 35.00, 10, 4, 'unidad', '1234567890133', 'D1-A2', 6, ARRAY['iphone', '12', 'carcasa', 'cristal']),

-- Herramientas
('HER-KIT-001', 'Kit de Destornilladores', 'Kit completo de destornilladores para reparación móvil', (SELECT id FROM categories WHERE name = 'Herramientas'), 'iFixit', (SELECT id FROM suppliers WHERE name = 'RepairPro Supplies'), 15.00, 35.00, 28.00, 8, 3, 'kit', '1234567890134', 'E1-A1', 24, ARRAY['herramientas', 'destornilladores', 'kit', 'reparacion']),
('HER-VEN-001', 'Ventosas de Apertura', 'Set de ventosas para apertura de dispositivos', (SELECT id FROM categories WHERE name = 'Herramientas'), 'Generic', (SELECT id FROM suppliers WHERE name = 'Digital Parts Co'), 3.00, 8.00, 6.00, 15, 5, 'set', '1234567890135', 'E1-A2', 12, ARRAY['ventosas', 'apertura', 'herramientas']),

-- Servicios
('SER-REP-PAN-001', 'Reparación de Pantalla', 'Servicio de reparación de pantalla (mano de obra)', (SELECT id FROM categories WHERE name = 'Servicios'), 'Servicio', NULL, 0.00, 25.00, 20.00, 999, 0, 'servicio', NULL, NULL, 0, ARRAY['servicio', 'reparacion', 'pantalla', 'mano-obra']),
('SER-REP-BAT-001', 'Cambio de Batería', 'Servicio de cambio de batería (mano de obra)', (SELECT id FROM categories WHERE name = 'Servicios'), 'Servicio', NULL, 0.00, 15.00, 12.00, 999, 0, 'servicio', NULL, NULL, 0, ARRAY['servicio', 'cambio', 'bateria', 'mano-obra']);

-- Actualizar algunos productos para generar alertas
UPDATE products SET stock = 2 WHERE sku = 'PNT-IPH-12-001'; -- Stock bajo
UPDATE products SET stock = 0 WHERE sku = 'CAR-IPH-12-001'; -- Sin stock
UPDATE products SET supplier_id = NULL WHERE sku = 'HER-VEN-001'; -- Sin proveedor