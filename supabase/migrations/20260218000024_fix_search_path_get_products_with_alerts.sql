CREATE OR REPLACE FUNCTION public.get_products_with_alerts(
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  sku TEXT,
  stock_quantity INTEGER,
  min_stock INTEGER,
  alert_type TEXT,
  alert_message TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.min_stock,
    pa.alert_type,
    pa.message as alert_message,
    pa.created_at
  FROM product_alerts pa
  JOIN products p ON pa.product_id = p.id
  WHERE pa.is_resolved = false
  ORDER BY pa.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
