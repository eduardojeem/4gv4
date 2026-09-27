CREATE OR REPLACE FUNCTION public.get_products_with_alerts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  stock_quantity INT,
  min_stock INT,
  max_stock INT,
  alert_type TEXT,
  alert_severity TEXT
) 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.min_stock,
    p.max_stock,
    CASE 
      WHEN p.stock_quantity = 0 THEN 'out_of_stock'
      WHEN p.stock_quantity <= p.min_stock THEN 'low_stock'
      WHEN p.stock_quantity > p.max_stock THEN 'overstock'
      ELSE 'normal'
    END as alert_type,
    CASE 
      WHEN p.stock_quantity = 0 THEN 'critical'
      WHEN p.stock_quantity <= 2 THEN 'high'
      WHEN p.stock_quantity <= p.min_stock THEN 'medium'
      WHEN p.stock_quantity > p.max_stock THEN 'low'
      ELSE 'none'
    END as alert_severity
  FROM products p
  WHERE 
    p.stock_quantity = 0 OR
    p.stock_quantity <= p.min_stock OR
    p.stock_quantity > p.max_stock
  ORDER BY 
    CASE 
      WHEN p.stock_quantity = 0 THEN 1
      WHEN p.stock_quantity <= 2 THEN 2
      WHEN p.stock_quantity <= p.min_stock THEN 3
      ELSE 4
    END,
    p.name;
END;
$$;
