-- Seed purchase order items for sample order
BEGIN;

WITH po AS (
  SELECT id FROM public.purchase_orders WHERE supplierName = 'Distribuidora ABC' ORDER BY createdAt DESC LIMIT 1
)
INSERT INTO public.purchase_order_items (order_id, product_id, supplierSKU, internalSKU, name, quantity, unitPrice, lineTotal, status)
SELECT po.id, NULL, 'SKU-USB-C-001', 'INT-USB-C-001', 'Cargador USB-C', 10, 45.00, 450.00, 'confirmed'
FROM po;

COMMIT;

