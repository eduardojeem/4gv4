-- Update get_supplier_stats function to match current schema
-- The suppliers table uses is_active (boolean), not status (text)
-- Also, rating and order stats columns do not exist on the table yet

-- Drop first to allow return type changes or signature updates without error
DROP FUNCTION IF EXISTS get_supplier_stats();

CREATE OR REPLACE FUNCTION get_supplier_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_suppliers', COUNT(*),
    'active_suppliers', COUNT(*) FILTER (WHERE is_active = true),
    'inactive_suppliers', COUNT(*) FILTER (WHERE is_active = false),
    'pending_suppliers', 0, -- No pending state in simple boolean
    'avg_rating', 0, -- Rating column does not exist yet
    'total_orders', 0, -- Order stats not yet implemented
    'total_amount', 0
  ) INTO result
  FROM suppliers;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions are correct
GRANT EXECUTE ON FUNCTION get_supplier_stats() TO authenticated;
