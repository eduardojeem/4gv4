-- Seed data for suppliers and related tables
BEGIN;

-- Insert sample suppliers
INSERT INTO public.suppliers (name, contact_person, email, phone, city, country, website, business_type, status, rating, notes)
VALUES
  ('Distribuidora ABC', 'Juan Pérez', 'contacto@abc.com', '+595 21 111111', 'Asunción', 'Paraguay', 'https://abc.com', 'distributor', 'active', 4, 'Proveedor confiable'),
  ('Mayorista XYZ', 'María López', 'ventas@xyz.com', '+595 21 222222', 'Lambaré', 'Paraguay', 'https://xyz.com', 'wholesaler', 'active', 5, 'Buen precio por volumen'),
  ('Servicios MNO', 'Carlos Díaz', 'info@mno.com', '+595 21 333333', 'Luque', 'Paraguay', 'https://mno.com', 'service_provider', 'pending', 3, 'En evaluación'),
  ('Retailer QRS', 'Ana Gómez', 'contact@qrs.com', '+595 21 444444', 'San Lorenzo', 'Paraguay', 'https://qrs.com', 'retailer', 'inactive', 2, 'Actividad baja'),
  ('Fabricante TUV', 'Pedro Silva', 'atencion@tuv.com', '+595 21 555555', 'Fernando de la Mora', 'Paraguay', 'https://tuv.com', 'manufacturer', 'active', 5, 'Tiempo de entrega óptimo');

-- Link products to first two suppliers
WITH s AS (
  SELECT id, name FROM public.suppliers WHERE name IN ('Distribuidora ABC','Mayorista XYZ')
)
INSERT INTO public.supplier_products (supplier_id, supplierSKU, internalSKU, name, category, unitPrice, currency, minimumOrderQuantity, leadTimeDays, availability)
SELECT s.id, CONCAT('SKU-', RIGHT(md5(s.name), 6)), CONCAT('INT-', RIGHT(md5(s.name), 6)), 
  CASE WHEN s.name = 'Distribuidora ABC' THEN 'Cargador USB-C' ELSE 'Funda de silicona' END,
  CASE WHEN s.name = 'Distribuidora ABC' THEN 'Accesorios' ELSE 'Accesorios' END,
  CASE WHEN s.name = 'Distribuidora ABC' THEN 45.00 ELSE 25.00 END,
  'USD', 10,
  CASE WHEN s.name = 'Distribuidora ABC' THEN 7 ELSE 5 END,
  'in_stock'
FROM s;

-- Create a sample purchase order for Distribuidora ABC
WITH sup AS (
  SELECT id, name FROM public.suppliers WHERE name = 'Distribuidora ABC'
)
INSERT INTO public.purchase_orders (orderNumber, supplierId, supplierName, status, subtotal, taxAmount, shippingCost, totalAmount, currency)
SELECT CONCAT('PO-', to_char(NOW(),'YYYYMMDDHH24MISS')), sup.id, sup.name, 'confirmed', 450.00, 45.00, 0.00, 495.00, 'USD' FROM sup;

COMMIT;

