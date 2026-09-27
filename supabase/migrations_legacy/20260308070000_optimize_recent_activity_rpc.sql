-- Optimize Recent Activity feed with a single RPC call
-- Respects RLS by NOT using SECURITY DEFINER (runs as invoker)

CREATE OR REPLACE FUNCTION get_recent_activity_feed(p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  type TEXT,
  amount NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  info_1 TEXT,
  info_2 TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_activity AS (
    (
      SELECT
        s.id,
        'sale'::TEXT as type,
        s.total_amount as amount,
        s.status,
        s.created_at,
        NULL::TEXT as info_1,
        NULL::TEXT as info_2
      FROM sales s
      ORDER BY s.created_at DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        r.id,
        'repair'::TEXT as type,
        r.final_cost as amount,
        r.status,
        r.created_at,
        r.device_brand as info_1,
        r.device_model as info_2
      FROM repairs r
      ORDER BY r.created_at DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        c.id,
        'customer'::TEXT as type,
        NULL::NUMERIC as amount,
        'new'::TEXT as status,
        c.created_at,
        c.name as info_1,
        NULL::TEXT as info_2
      FROM customers c
      ORDER BY c.created_at DESC
      LIMIT p_limit
    )
  )
  SELECT *
  FROM all_activity
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_activity_feed(int) TO authenticated;
