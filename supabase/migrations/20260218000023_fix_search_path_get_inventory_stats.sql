CREATE OR REPLACE FUNCTION public.get_inventory_stats()
RETURNS TABLE (
  total_products BIGINT,
  active_products BIGINT,
  total_stock_value NUMERIC,
  total_cost_value NUMERIC,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  overstock_count BIGINT
) 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE is_active = true)::BIGINT as active_products,
    COALESCE(SUM(sale_price * stock_quantity), 0) as total_stock_value,
    COALESCE(SUM(purchase_price * stock_quantity), 0) as total_cost_value,
    COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND stock_quantity > 0)::BIGINT as low_stock_count,
    COUNT(*) FILTER (WHERE stock_quantity = 0)::BIGINT as out_of_stock_count,
    COUNT(*) FILTER (WHERE max_stock IS NOT NULL AND stock_quantity > max_stock)::BIGINT as overstock_count
  FROM products;
END;
$$;
