-- Migration to add more categories, subcategories, and brands

-- 1. Add Brands
INSERT INTO brands (name, is_active) VALUES
('Sony', true),
('LG', true),
('Dell', true),
('HP', true),
('Lenovo', true),
('Asus', true),
('Microsoft', true),
('Nintendo', true),
('Canon', true),
('Epson', true),
('Xiaomi', true),
('Huawei', true),
('Motorola', true),
('Logitech', true),
('Kingston', true),
('JBL', true),
('Acer', true),
('Razer', true),
('Corsair', true),
('MSI', true),
('Gigabyte', true),
('AMD', true),
('Intel', true),
('Nvidia', true),
('Western Digital', true),
('Seagate', true),
('TP-Link', true),
('Ubiquiti', true),
('Hikvision', true),
('Dahua', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Add Top-Level Categories
-- Check if they exist before inserting to avoid duplicates if name is not unique constraint
INSERT INTO categories (name, description, is_active)
SELECT 'Informática', 'Computadoras, portátiles y componentes', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Informática');

INSERT INTO categories (name, description, is_active)
SELECT 'Audio y Video', 'Equipos de sonido, TV y video', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Audio y Video');

INSERT INTO categories (name, description, is_active)
SELECT 'Gaming', 'Consolas, juegos y accesorios gamer', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Gaming');

INSERT INTO categories (name, description, is_active)
SELECT 'Oficina', 'Equipamiento y suministros de oficina', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Oficina');

INSERT INTO categories (name, description, is_active)
SELECT 'Redes', 'Routers, switches y conectividad', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Redes');

INSERT INTO categories (name, description, is_active)
SELECT 'Seguridad', 'Cámaras de vigilancia y alarmas', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Seguridad');


-- 3. Add Subcategories

-- Helper function to get category id by name
-- We can't use functions easily in standard SQL script without defining them, so we use CTEs or subqueries.

-- Informática Subcategories
WITH parent AS (SELECT id FROM categories WHERE name = 'Informática' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Notebooks', 'Laptops y portátiles', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Notebooks' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Informática' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Componentes de PC', 'Procesadores, RAM, Discos, etc.', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Componentes de PC' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Informática' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Periféricos', 'Teclados, mouse, monitores', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Periféricos' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Informática' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Almacenamiento', 'Discos duros, SSD, USB', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Almacenamiento' AND parent_id = (SELECT id FROM parent));

-- Audio y Video Subcategories
WITH parent AS (SELECT id FROM categories WHERE name = 'Audio y Video' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Televisores', 'Smart TV y pantallas', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Televisores' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Audio y Video' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Audífonos', 'Auriculares in-ear, over-ear', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Audífonos' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Audio y Video' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Parlantes', 'Bocinas y sistemas de sonido', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Parlantes' AND parent_id = (SELECT id FROM parent));

-- Gaming Subcategories
WITH parent AS (SELECT id FROM categories WHERE name = 'Gaming' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Consolas', 'PlayStation, Xbox, Nintendo', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Consolas' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Gaming' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Videojuegos', 'Juegos para todas las plataformas', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Videojuegos' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Gaming' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Sillas Gamer', 'Sillas ergonómicas para gaming', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Sillas Gamer' AND parent_id = (SELECT id FROM parent));

-- Oficina Subcategories
WITH parent AS (SELECT id FROM categories WHERE name = 'Oficina' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Impresoras', 'Inyección de tinta, láser, multifuncionales', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Impresoras' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Oficina' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Suministros', 'Tintas, toners, papel', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Suministros' AND parent_id = (SELECT id FROM parent));

-- Redes Subcategories
WITH parent AS (SELECT id FROM categories WHERE name = 'Redes' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Routers', 'Routers WiFi y cableados', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Routers' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Redes' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Switches', 'Switches de red', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Switches' AND parent_id = (SELECT id FROM parent));

-- Seguridad Subcategories
WITH parent AS (SELECT id FROM categories WHERE name = 'Seguridad' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'Cámaras de Seguridad', 'Cámaras IP, CCTV', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Cámaras de Seguridad' AND parent_id = (SELECT id FROM parent));

WITH parent AS (SELECT id FROM categories WHERE name = 'Seguridad' LIMIT 1)
INSERT INTO categories (name, description, parent_id, is_active)
SELECT 'DVR/NVR', 'Grabadores de video', id, true FROM parent
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'DVR/NVR' AND parent_id = (SELECT id FROM parent));

-- Update any products that match the new brands
UPDATE products p
SET brand_id = b.id
FROM brands b
WHERE p.brand = b.name
AND p.brand_id IS NULL;
