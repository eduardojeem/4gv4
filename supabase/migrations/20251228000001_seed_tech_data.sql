-- Seed data for Products, Categories, and Suppliers
-- Focus: Informatics and Mobile Phone Spare Parts

BEGIN;

-- 1. Insert Categories
WITH new_categories AS (
    INSERT INTO categories (name, description, is_active)
    VALUES 
        ('Informática', 'Computadoras, laptops, componentes de PC y periféricos', true),
        ('Repuestos Celulares', 'Pantallas, displays, baterías, flex y repuestos internos', true),
        ('Accesorios', 'Cables, cargadores, fundas, vidrios templados', true),
        ('Herramientas', 'Herramientas para reparación de celulares y PCs', true)
    RETURNING id, name
),

-- 2. Insert Suppliers
new_suppliers AS (
    INSERT INTO suppliers (name, contact_name, email, phone, address, is_active)
    VALUES 
        ('TechData Import', 'Roberto Méndez', 'ventas@techdata.example.com', '+54 11 5555-0100', 'Av. Corrientes 1234, CABA', true),
        ('MobileParts Center', 'Ana López', 'pedidos@mobileparts.example.com', '+54 11 5555-0200', 'Calle Florida 500, Local 12', true),
        ('MegaByte Distribuidora', 'Carlos Ruiz', 'contacto@megabyte.example.com', '+54 11 5555-0300', 'Av. Belgrano 200, Piso 5', true)
    RETURNING id, name
)

-- 3. Insert Products
INSERT INTO products (
    sku, name, description, category_id, supplier_id, brand, 
    purchase_price, sale_price, stock_quantity, min_stock, unit_measure, is_active, 
    images
)
-- INFORMATICA (Supplier: TechData Import)
SELECT 
    'LAP-HP-15', 'Laptop HP Pavilion 15"', 'Intel Core i5 1135G7, 8GB RAM, 512GB SSD, Windows 11', 
    c.id, s.id, 'HP', 
    650.00, 899.99, 8, 2, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1603302576837-37561b2e2302']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Informática' AND s.name = 'TechData Import'

UNION ALL

SELECT 
    'SSD-KING-480', 'Disco Sólido SSD 480GB', 'Kingston A400 SATA3 2.5"', 
    c.id, s.id, 'Kingston', 
    25.00, 45.00, 50, 5, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1597872250977-479e782e4f0d']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Informática' AND s.name = 'TechData Import'

UNION ALL

SELECT 
    'RAM-DDR4-8GB', 'Memoria RAM DDR4 8GB 3200MHz', 'HyperX Fury Black para PC de escritorio', 
    c.id, s.id, 'HyperX', 
    35.00, 55.00, 30, 5, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1562976540-1502c2145186']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Informática' AND s.name = 'MegaByte Distribuidora'

UNION ALL

-- REPUESTOS CELULARES (Supplier: MobileParts Center)
SELECT 
    'DISP-IP13-PM', 'Pantalla iPhone 13 Pro Max (OLED)', 'Display completo calidad original, incluye marco', 
    c.id, s.id, 'Apple', 
    180.00, 250.00, 15, 3, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1603539279542-e87e914092b3']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Repuestos Celulares' AND s.name = 'MobileParts Center'

UNION ALL

SELECT 
    'BAT-SAM-S21', 'Batería Samsung S21', 'Batería original EB-BG991ABY 4000mAh', 
    c.id, s.id, 'Samsung', 
    15.00, 35.00, 40, 5, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Repuestos Celulares' AND s.name = 'MobileParts Center'

UNION ALL

SELECT 
    'MOD-MOTO-G60', 'Módulo Display Moto G60', 'Pantalla IPS LCD con marco, calidad AAA', 
    c.id, s.id, 'Motorola', 
    28.00, 55.00, 20, 4, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1598327773297-9e900995c643']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Repuestos Celulares' AND s.name = 'MobileParts Center'

UNION ALL

SELECT 
    'PIN-XIA-NOTE10', 'Placa de Carga Xiaomi Note 10', 'Placa completa con micrófono y conector USB-C', 
    c.id, s.id, 'Xiaomi', 
    5.00, 12.00, 100, 10, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1603539279542-e87e914092b3']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Repuestos Celulares' AND s.name = 'MobileParts Center'

UNION ALL

-- ACCESORIOS (Supplier: MegaByte Distribuidora)
SELECT 
    'CHG-SAM-25W', 'Cargador Samsung 25W', 'Cargador de pared Super Fast Charging USB-C (Sin cable)', 
    c.id, s.id, 'Samsung', 
    12.00, 25.00, 60, 10, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1583863788434-e58a36330cf0']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Accesorios' AND s.name = 'MegaByte Distribuidora'

UNION ALL

SELECT 
    'CABLE-IP-USBC', 'Cable USB-C a Lightning', 'Cable de 1 metro, certificado MFi, caja original', 
    c.id, s.id, 'Apple', 
    8.00, 18.00, 80, 10, 'unidad', true, 
    ARRAY['https://images.unsplash.com/photo-1585338676231-15822b311394']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Accesorios' AND s.name = 'MegaByte Distribuidora'

UNION ALL

-- HERRAMIENTAS (Supplier: MobileParts Center)
SELECT 
    'KIT-DEST-PRO', 'Kit Destornilladores Precisión 24 en 1', 'Set magnético para reparación de celulares y laptops', 
    c.id, s.id, 'Generic', 
    10.00, 22.00, 25, 5, 'set', true, 
    ARRAY['https://images.unsplash.com/photo-1581092160562-40aa08e78837']
FROM new_categories c, new_suppliers s
WHERE c.name = 'Herramientas' AND s.name = 'MobileParts Center';

COMMIT;
