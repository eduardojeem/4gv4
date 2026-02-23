
-- Asegurar que existe la categoría de Servicios
DO $$
DECLARE
    service_cat_id uuid;
BEGIN
    -- Buscar o crear categoría Servicios
    SELECT id INTO service_cat_id FROM categories WHERE name = 'Servicios' LIMIT 1;
    
    IF service_cat_id IS NULL THEN
        INSERT INTO categories (name, description)
        VALUES ('Servicios', 'Mano de obra y reparaciones')
        RETURNING id INTO service_cat_id;
    END IF;

    -- Insertar servicios de ejemplo
    INSERT INTO products (
        name, 
        description, 
        sale_price, 
        wholesale_price, 
        purchase_price, 
        category_id, 
        stock_quantity, 
        min_stock, 
        sku, 
        is_active, 
        unit_measure
    )
    VALUES 
        -- iPhones - Pantallas
        ('Cambio Pantalla iPhone X', 'Pantalla OLED Calidad Original + Instalación', 80.00, 65.00, 45.00, service_cat_id, 9999, 0, 'SRV-IPX-SCR', true, 'servicio'),
        ('Cambio Pantalla iPhone 11', 'Pantalla LCD Premium + Instalación', 70.00, 55.00, 35.00, service_cat_id, 9999, 0, 'SRV-IP11-SCR', true, 'servicio'),
        ('Cambio Pantalla iPhone 12', 'Pantalla OLED Soft + Instalación', 110.00, 90.00, 65.00, service_cat_id, 9999, 0, 'SRV-IP12-SCR', true, 'servicio'),
        ('Cambio Pantalla iPhone 13', 'Pantalla OLED Hard + Instalación', 130.00, 110.00, 75.00, service_cat_id, 9999, 0, 'SRV-IP13-SCR', true, 'servicio'),
        ('Cambio Pantalla iPhone 14', 'Pantalla OLED Original Refurb + Instalación', 180.00, 150.00, 120.00, service_cat_id, 9999, 0, 'SRV-IP14-SCR', true, 'servicio'),
        ('Cambio Pantalla iPhone 15', 'Pantalla OLED Original Pull + Instalación', 250.00, 220.00, 180.00, service_cat_id, 9999, 0, 'SRV-IP15-SCR', true, 'servicio'),

        -- iPhones - Baterías
        ('Cambio Batería iPhone X', 'Batería Alta Capacidad + Instalación', 40.00, 30.00, 15.00, service_cat_id, 9999, 0, 'SRV-IPX-BAT', true, 'servicio'),
        ('Cambio Batería iPhone 11', 'Batería Original Chip + Instalación', 45.00, 35.00, 18.00, service_cat_id, 9999, 0, 'SRV-IP11-BAT', true, 'servicio'),
        ('Cambio Batería iPhone 12', 'Batería BMS Transplant + Instalación', 55.00, 45.00, 20.00, service_cat_id, 9999, 0, 'SRV-IP12-BAT', true, 'servicio'),
        ('Cambio Batería iPhone 13', 'Batería BMS Transplant + Instalación', 65.00, 50.00, 25.00, service_cat_id, 9999, 0, 'SRV-IP13-BAT', true, 'servicio'),

        -- Samsung - Pantallas
        ('Cambio Pantalla Samsung S20', 'Módulo Original con Marco + Instalación', 160.00, 140.00, 120.00, service_cat_id, 9999, 0, 'SRV-S20-SCR', true, 'servicio'),
        ('Cambio Pantalla Samsung S21', 'Módulo Original con Marco + Instalación', 170.00, 150.00, 130.00, service_cat_id, 9999, 0, 'SRV-S21-SCR', true, 'servicio'),
        ('Cambio Pantalla Samsung S22', 'Módulo Original con Marco + Instalación', 190.00, 170.00, 150.00, service_cat_id, 9999, 0, 'SRV-S22-SCR', true, 'servicio'),
        ('Cambio Pantalla Samsung A52', 'Módulo Original + Instalación', 90.00, 75.00, 60.00, service_cat_id, 9999, 0, 'SRV-A52-SCR', true, 'servicio'),
        ('Cambio Pantalla Samsung A14', 'Módulo Original + Instalación', 50.00, 40.00, 25.00, service_cat_id, 9999, 0, 'SRV-A14-SCR', true, 'servicio'),

        -- Pines de Carga
        ('Cambio Pin de Carga Genérico', 'Soldadura de puerto MicroUSB/Type-C', 25.00, 15.00, 2.00, service_cat_id, 9999, 0, 'SRV-CHG-GEN', true, 'servicio'),
        ('Cambio Flex de Carga iPhone', 'Reemplazo de Flex de Carga Completo', 35.00, 25.00, 10.00, service_cat_id, 9999, 0, 'SRV-CHG-IP', true, 'servicio'),

        -- Software y Mantenimiento
        ('Limpieza General Profunda', 'Limpieza de parlantes, micrófonos y puerto', 15.00, 10.00, 0.00, service_cat_id, 9999, 0, 'SRV-CLN-FULL', true, 'servicio'),
        ('Baño Químico', 'Tratamiento para equipos mojados', 40.00, 30.00, 5.00, service_cat_id, 9999, 0, 'SRV-WTR-DMG', true, 'servicio'),
        ('Software / Flasheo', 'Reinstalación de sistema operativo', 30.00, 20.00, 0.00, service_cat_id, 9999, 0, 'SRV-SFT-FLS', true, 'servicio'),
        ('Backup de Datos', 'Copia de seguridad de información', 20.00, 15.00, 0.00, service_cat_id, 9999, 0, 'SRV-DATA-BKP', true, 'servicio'),
        ('Instalación Hidrogel', 'Colocación de protector de pantalla', 10.00, 5.00, 2.00, service_cat_id, 9999, 0, 'SRV-PRT-GEL', true, 'servicio')
    ON CONFLICT (sku) DO UPDATE SET
        sale_price = EXCLUDED.sale_price,
        description = EXCLUDED.description,
        is_active = true;

END $$;
