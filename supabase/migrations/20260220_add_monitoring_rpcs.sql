-- Function to get database size info
CREATE OR REPLACE FUNCTION get_database_size_info()
RETURNS TABLE (
  total_size_bytes bigint,
  total_size_mb numeric,
  total_size_gb numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pg_database_size(current_database()) as total_size_bytes,
    round(pg_database_size(current_database()) / (1024.0 * 1024.0), 2) as total_size_mb,
    round(pg_database_size(current_database()) / (1024.0 * 1024.0 * 1024.0), 2) as total_size_gb;
END;
$$;

-- Function to get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
  schema_name text,
  table_name text,
  size_bytes bigint,
  size_pretty text,
  row_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::text,
    tablename::text,
    pg_total_relation_size(schemaname || '.' || tablename) as size_bytes,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size_pretty,
    (n_live_tup)::bigint as row_count
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
END;
$$;

-- Function to get database connection stats
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
  metric text,
  value text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 'Active Connections'::text, count(*)::text
  FROM pg_stat_activity
  WHERE state = 'active';

  RETURN QUERY
  SELECT 'Total Connections'::text, count(*)::text
  FROM pg_stat_activity;
END;
$$;

-- Function to get query performance metrics (simplified)
CREATE OR REPLACE FUNCTION get_query_performance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  cache_hit_ratio numeric;
BEGIN
  SELECT round((sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0)), 2)
  INTO cache_hit_ratio
  FROM pg_stat_database
  WHERE datname = current_database();

  -- Fallback if null (e.g. fresh db)
  IF cache_hit_ratio IS NULL THEN
    cache_hit_ratio := 100.0;
  END IF;

  SELECT json_build_object(
    'avgQueryTime', 0, 
    'queriesPerSecond', 0,
    'cacheHitRatio', cache_hit_ratio,
    'slowQueries', '[]'::json
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to perform maintenance tasks
CREATE OR REPLACE FUNCTION perform_maintenance_task(task_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF task_name = 'reset_stats' THEN
    -- Requires appropriate privileges, might fail if not superuser
    -- But in Supabase migrations this usually runs as a high privilege user
    PERFORM pg_stat_reset();
    RETURN true;
  END IF;
  
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Grant execute permissions to authenticated users (or service_role only if strict)
GRANT EXECUTE ON FUNCTION get_database_size_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_size_info() TO service_role;

GRANT EXECUTE ON FUNCTION get_table_sizes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_sizes() TO service_role;

GRANT EXECUTE ON FUNCTION get_database_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_stats() TO service_role;

GRANT EXECUTE ON FUNCTION get_query_performance() TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_performance() TO service_role;

GRANT EXECUTE ON FUNCTION perform_maintenance_task(text) TO authenticated;
GRANT EXECUTE ON FUNCTION perform_maintenance_task(text) TO service_role;
