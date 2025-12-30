-- Seed example services
-- Run this in Supabase SQL Editor after the schema alignment migration

WITH service_cat AS (SELECT id FROM categories WHERE name = 'Servicios' LIMIT 1)
INSERT INTO products (
    name, description, sale_price, wholesale_price, purchase_price, 
    category_id, stock_quantity, min_stock, sku, is_active, unit_measure
)
VALUES 
    ('Cambio Pantalla iPhone 13', 'Repuesto calidad original + Mano de obra', 120.00, 100.00, 60.00, (SELECT id FROM service_cat), 9999, 0, 'SRV-IP13-SCR', true, 'servicio'),
    ('Cambio Batería iPhone 11', 'Batería nueva + Instalación', 45.00, 35.00, 15.00, (SELECT id FROM service_cat), 9999, 0, 'SRV-IP11-BAT', true, 'servicio'),
    ('Limpieza General', 'Mantenimiento preventivo', 25.00, 15.00, 0.00, (SELECT id FROM service_cat), 9999, 0, 'SRV-GEN-CLN', true, 'servicio'),
    ('Diagnóstico Avanzado', 'Revisión de placa microscopio', 30.00, 20.00, 0.00, (SELECT id FROM service_cat), 9999, 0, 'SRV-DIAG-ADV', true, 'servicio'),
    ('Reparación Placa iPhone 11', 'No prende / Corto en VCC_MAIN', 80.00, 60.00, 10.00, (SELECT id FROM service_cat), 9999, 0, 'SRV-IP11-MB', true, 'servicio')
ON CONFLICT (sku) DO NOTHING;
