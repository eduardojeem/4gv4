-- Function to calculate supplier statistics efficiently
-- This replaces multiple client-side queries with a single database call

CREATE OR REPLACE FUNCTION get_supplier_stats()
RETURNS json 
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_suppliers', COUNT(*),
    'active_suppliers', COUNT(*) FILTER (WHERE status = 'active'),
    'inactive_suppliers', COUNT(*) FILTER (WHERE status = 'inactive'),
    'pending_suppliers', COUNT(*) FILTER (WHERE status = 'pending'),
    'avg_rating', COALESCE(AVG(rating), 0),
    'total_orders', COALESCE(SUM(total_orders), 0),
    'total_amount', COALESCE(SUM(total_amount), 0)
  ) INTO result
  FROM suppliers;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_supplier_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_supplier_stats() IS 'Returns aggregated statistics for all suppliers in a single query for better performance';
