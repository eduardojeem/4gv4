-- Fix supplier stats function by dropping and recreating it
-- This resolves the return type conflict

BEGIN;

-- Drop the existing function if it exists (with CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS get_supplier_stats() CASCADE;

-- Create the corrected function with proper return type
CREATE OR REPLACE FUNCTION get_supplier_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_suppliers', COUNT(*)::bigint,
        'active_suppliers', COUNT(*) FILTER (WHERE status = 'active')::bigint,
        'inactive_suppliers', COUNT(*) FILTER (WHERE status = 'inactive')::bigint,
        'pending_suppliers', COUNT(*) FILTER (WHERE status = 'pending')::bigint,
        'avg_rating', COALESCE(AVG(rating), 0)::numeric,
        'total_orders', COALESCE(SUM(total_orders), 0)::bigint,
        'total_amount', COALESCE(SUM(total_amount), 0)::numeric
    ) INTO result
    FROM suppliers;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_supplier_stats() TO authenticated;

COMMIT;