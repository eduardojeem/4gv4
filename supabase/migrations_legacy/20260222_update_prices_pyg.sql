
-- Actualizar precios de servicios a Guaraníes (PYG)
-- Tasa de conversión aproximada: 1 USD = 7.500 PYG (ajustado para redondear)

-- iPhones - Pantallas
UPDATE products SET sale_price = 600000, wholesale_price = 480000, purchase_price = 340000 WHERE sku = 'SRV-IPX-SCR';
UPDATE products SET sale_price = 525000, wholesale_price = 410000, purchase_price = 260000 WHERE sku = 'SRV-IP11-SCR';
UPDATE products SET sale_price = 825000, wholesale_price = 675000, purchase_price = 480000 WHERE sku = 'SRV-IP12-SCR';
UPDATE products SET sale_price = 975000, wholesale_price = 825000, purchase_price = 560000 WHERE sku = 'SRV-IP13-SCR';
UPDATE products SET sale_price = 1350000, wholesale_price = 1125000, purchase_price = 900000 WHERE sku = 'SRV-IP14-SCR';
UPDATE products SET sale_price = 1875000, wholesale_price = 1650000, purchase_price = 1350000 WHERE sku = 'SRV-IP15-SCR';

-- iPhones - Baterías
UPDATE products SET sale_price = 300000, wholesale_price = 225000, purchase_price = 110000 WHERE sku = 'SRV-IPX-BAT';
UPDATE products SET sale_price = 330000, wholesale_price = 260000, purchase_price = 135000 WHERE sku = 'SRV-IP11-BAT';
UPDATE products SET sale_price = 410000, wholesale_price = 330000, purchase_price = 150000 WHERE sku = 'SRV-IP12-BAT';
UPDATE products SET sale_price = 480000, wholesale_price = 375000, purchase_price = 180000 WHERE sku = 'SRV-IP13-BAT';

-- Samsung - Pantallas
UPDATE products SET sale_price = 1200000, wholesale_price = 1050000, purchase_price = 900000 WHERE sku = 'SRV-S20-SCR';
UPDATE products SET sale_price = 1275000, wholesale_price = 1125000, purchase_price = 975000 WHERE sku = 'SRV-S21-SCR';
UPDATE products SET sale_price = 1425000, wholesale_price = 1275000, purchase_price = 1125000 WHERE sku = 'SRV-S22-SCR';
UPDATE products SET sale_price = 675000, wholesale_price = 560000, purchase_price = 450000 WHERE sku = 'SRV-A52-SCR';
UPDATE products SET sale_price = 375000, wholesale_price = 300000, purchase_price = 180000 WHERE sku = 'SRV-A14-SCR';

-- Pines de Carga
UPDATE products SET sale_price = 180000, wholesale_price = 110000, purchase_price = 15000 WHERE sku = 'SRV-CHG-GEN';
UPDATE products SET sale_price = 260000, wholesale_price = 180000, purchase_price = 75000 WHERE sku = 'SRV-CHG-IP';

-- Software y Mantenimiento
UPDATE products SET sale_price = 110000, wholesale_price = 75000, purchase_price = 0 WHERE sku = 'SRV-CLN-FULL';
UPDATE products SET sale_price = 300000, wholesale_price = 225000, purchase_price = 35000 WHERE sku = 'SRV-WTR-DMG';
UPDATE products SET sale_price = 225000, wholesale_price = 150000, purchase_price = 0 WHERE sku = 'SRV-SFT-FLS';
UPDATE products SET sale_price = 150000, wholesale_price = 110000, purchase_price = 0 WHERE sku = 'SRV-DATA-BKP';
UPDATE products SET sale_price = 75000, wholesale_price = 35000, purchase_price = 15000 WHERE sku = 'SRV-PRT-GEL';

-- Asegurar que los productos nuevos se muestren en guaraníes si es necesario (en la UI se manejará el formato)
-- Esta migración solo actualiza los valores numéricos en la base de datos.
