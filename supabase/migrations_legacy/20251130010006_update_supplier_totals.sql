-- Update aggregate totals on suppliers based on related tables
BEGIN;

-- Update total_orders and total_amount using purchase_orders
UPDATE public.suppliers s
SET total_orders = COALESCE(po.cnt, 0),
    total_amount = COALESCE(po.sum, 0)
FROM (
  SELECT supplierId AS sid, COUNT(*) AS cnt, COALESCE(SUM(totalAmount), 0) AS sum
  FROM public.purchase_orders
  GROUP BY supplierId
) po
WHERE po.sid = s.id;

-- Update products_count using supplier_products
UPDATE public.suppliers s
SET products_count = COALESCE(sp.cnt, 0)
FROM (
  SELECT supplier_id AS sid, COUNT(*) AS cnt
  FROM public.supplier_products
  GROUP BY supplier_id
) sp
WHERE sp.sid = s.id;

COMMIT;

