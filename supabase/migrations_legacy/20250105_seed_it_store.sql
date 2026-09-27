-- =====================================================
-- SCRIPT DE REINICIO Y DATOS DE EJEMPLO: NEGOCIO IT/CELULARES
-- Fecha: 2025-01-05
-- Descripción: Limpia productos existentes y carga datos para tienda de tecnología
-- =====================================================

-- 1. LIMPIEZA DE DATOS (Ordenada para evitar errores de FK)
-- Usamos TRUNCATE CASCADE para limpiar tablas dependientes automáticamente si es posible
-- Si falla, hacemos DELETE en orden

DO $$
BEGIN
    -- Intentar limpiar tablas relacionadas con movimientos y alertas primero
    DELETE FROM product_movements;
    DELETE FROM product_alerts;
    DELETE FROM product_price_history;
    
    -- Limpiar productos (esto podría fallar si hay ventas asociadas sin cascade)
    -- Si hay ventas, idealmente deberíamos mantener los productos o borrarlas.
    -- Asumimos que es un reinicio deseado.
    DELETE FROM products;
    
    -- Limpiar catálogos
    DELETE FROM categories;
    DELETE FROM suppliers;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'No se pudieron borrar algunos registros debido a ventas existentes. Se intentará insertar datos nuevos de todas formas.';
END $$;

-- 2. INSERTAR CATEGORÍAS
-- Guardamos los IDs en variables para usarlos en productos
WITH new_categories AS (
    INSERT INTO categories (name, description, is_active) VALUES
    ('Repuestos Celulares', 'Pantallas, baterías, módulos y componentes internos', true),
    ('Accesorios Móviles', 'Cargadores, cables, fundas y protección', true),
    ('Computación', 'Hardware, periféricos y almacenamiento', true),
    ('Servicio Técnico', 'Mano de obra, reparaciones y mantenimiento', true),
    ('Audio y Video', 'Auriculares, parlantes y cámaras', true)
    RETURNING id, name
),
-- 3. INSERTAR PROVEEDORES
new_suppliers AS (
    INSERT INTO suppliers (name, contact_person, email, phone, status, address) VALUES
    ('TecnoGlobal Importadora', 'Juan Pérez', 'ventas@tecnoglobal.com', '+555123456', 'active', 'Av. Tecnología 123'),
    ('Mundo Móvil Repuestos', 'María González', 'contacto@mundomovil.com', '+555987654', 'active', 'Calle Celular 456'),
    ('CompuParts Distribuidora', 'Carlos Ruiz', 'pedidos@compuparts.com', '+555111222', 'active', 'Polígono Industrial Norte')
    RETURNING id, name
),
-- 4. INSERTAR PRODUCTOS
inserted_products AS (
    INSERT INTO products (
        sku, name, description, category_id, supplier_id, 
        purchase_price, sale_price, stock_quantity, min_stock, 
        barcode, unit_measure, is_active, images
    )
    SELECT 
        p.sku, p.name, p.description, c.id, s.id, 
        p.purchase_price, p.sale_price, p.stock_quantity, p.min_stock, 
        p.barcode, p.unit_measure, true, p.images
    FROM (VALUES 
        -- REPUESTOS CELULARES (Proveedor: Mundo Móvil)
        ('REP-IP11-LCD', 'Pantalla iPhone 11 Incell', 'Módulo completo LCD para iPhone 11, calidad AAA', 'Repuestos Celulares', 'Mundo Móvil Repuestos', 25.00, 45.00, 15, 3, '789001', 'unidad', ARRAY['https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=300&q=80']),
        ('REP-SAM-A51', 'Módulo Samsung A51 Original', 'Pantalla Super AMOLED Samsung Galaxy A51 con marco', 'Repuestos Celulares', 'Mundo Móvil Repuestos', 45.00, 80.00, 8, 2, '789002', 'unidad', ARRAY['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=300&q=80']),
        ('BAT-IPX', 'Batería iPhone X', 'Batería de litio reemplazo para iPhone X 2716mAh', 'Repuestos Celulares', 'Mundo Móvil Repuestos', 12.00, 25.00, 20, 5, '789003', 'unidad', ARRAY['https://images.unsplash.com/photo-1590374565749-060144d8544d?auto=format&fit=crop&w=300&q=80']),
        ('FLEX-CARGA-IP12', 'Flex de Carga iPhone 12', 'Conector de carga Lightning y micrófono', 'Repuestos Celulares', 'Mundo Móvil Repuestos', 8.00, 18.00, 10, 2, '789004', 'unidad', NULL),
        
        -- ACCESORIOS MÓVILES (Proveedor: TecnoGlobal)
        ('ACC-CARG-20W', 'Cargador Rápido 20W USB-C', 'Cubo de carga rápida compatible con iPhone/Samsung', 'Accesorios Móviles', 'TecnoGlobal Importadora', 5.00, 12.00, 50, 10, '789005', 'unidad', ARRAY['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=300&q=80']),
        ('ACC-CAB-IP-1M', 'Cable Lightning a USB-C 1m', 'Cable de datos y carga reforzado', 'Accesorios Móviles', 'TecnoGlobal Importadora', 3.00, 8.00, 60, 15, '789006', 'unidad', ARRAY['https://images.unsplash.com/photo-1594540997424-4f0e6981883c?auto=format&fit=crop&w=300&q=80']),
        ('ACC-FUND-IP13', 'Funda Silicona iPhone 13', 'Case protector de silicona suave, varios colores', 'Accesorios Móviles', 'TecnoGlobal Importadora', 2.50, 8.00, 30, 5, '789007', 'unidad', ARRAY['https://images.unsplash.com/photo-1603351154351-5cfb3d04ef32?auto=format&fit=crop&w=300&q=80']),
        ('ACC-VID-UNI', 'Vidrio Templado Universal', 'Protector de pantalla 9H genérico', 'Accesorios Móviles', 'TecnoGlobal Importadora', 0.50, 3.00, 100, 20, '789008', 'unidad', NULL),
        
        -- COMPUTACIÓN (Proveedor: CompuParts)
        ('COM-SSD-480', 'SSD Kingston 480GB', 'Unidad de estado sólido SATA 2.5"', 'Computación', 'CompuParts Distribuidora', 28.00, 45.00, 12, 3, '789009', 'unidad', ARRAY['https://images.unsplash.com/photo-1597872252165-482c0e3a3628?auto=format&fit=crop&w=300&q=80']),
        ('COM-RAM-8GB', 'Memoria RAM DDR4 8GB 3200MHz', 'Módulo de memoria para PC de escritorio', 'Computación', 'CompuParts Distribuidora', 22.00, 38.00, 15, 4, '789010', 'unidad', ARRAY['https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=300&q=80']),
        ('COM-MOUSE-LOG', 'Mouse Logitech M170', 'Mouse inalámbrico óptico básico', 'Computación', 'CompuParts Distribuidora', 8.00, 15.00, 25, 5, '789011', 'unidad', ARRAY['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=300&q=80']),
        ('COM-TECL-MEC', 'Teclado Mecánico RGB', 'Teclado gamer switches azules', 'Computación', 'CompuParts Distribuidora', 35.00, 65.00, 8, 2, '789012', 'unidad', ARRAY['https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=300&q=80']),
        ('COM-IMP-EPS', 'Impresora Epson L3250', 'Multifuncional sistema continuo WiFi', 'Computación', 'CompuParts Distribuidora', 180.00, 250.00, 3, 1, '789013', 'unidad', ARRAY['https://images.unsplash.com/photo-1612815154858-60aa4c46ae43?auto=format&fit=crop&w=300&q=80']),
        
        -- AUDIO Y VIDEO (Proveedor: TecnoGlobal)
        ('AUD-JBL-GO3', 'Parlante JBL Go 3', 'Parlante portátil Bluetooth resistente al agua', 'Audio y Video', 'TecnoGlobal Importadora', 28.00, 42.00, 10, 3, '789014', 'unidad', ARRAY['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=300&q=80']),
        ('AUD-AIR-PRO', 'Auriculares TWS Pro', 'Réplica AAA auriculares inalámbricos cancelación ruido', 'Audio y Video', 'TecnoGlobal Importadora', 15.00, 35.00, 20, 5, '789015', 'unidad', ARRAY['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=300&q=80']),

        -- SERVICIO TÉCNICO (Sin proveedor o interno)
        ('SERV-MAN-01', 'Mano de Obra General', 'Servicio técnico básico por hora', 'Servicio Técnico', 'TecnoGlobal Importadora', 0.00, 15.00, 999, 0, 'SERV001', 'hora', NULL),
        ('SERV-FMT-PC', 'Formateo e Instalación SO', 'Instalación de Windows + Drivers + Office', 'Servicio Técnico', 'CompuParts Distribuidora', 0.00, 25.00, 999, 0, 'SERV002', 'servicio', NULL)

    ) AS p(sku, name, description, category_name, supplier_name, purchase_price, sale_price, stock_quantity, min_stock, barcode, unit_measure, is_active, images)
    JOIN new_categories c ON c.name = p.category_name
    JOIN new_suppliers s ON s.name = p.supplier_name
)
SELECT count(*) FROM inserted_products;
