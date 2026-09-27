-- ============================================================================
-- Fix monitoring functions search_path to be immutable (security best practice)
-- Fixes "Function has a role mutable search_path" for:
--   get_database_size_info
--   get_table_sizes
--   get_database_stats
--   get_query_performance
--   perform_maintenance_task
-- Fecha: 2026-03-10
-- ============================================================================

-- 1. get_database_size_info
CREATE OR REPLACE FUNCTION public.get_database_size_info()
RETURNS TABLE (
  total_size_bytes bigint,
  total_size_mb numeric,
  total_size_gb numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pg_database_size(current_database()) as total_size_bytes,
    round(pg_database_size(current_database()) / (1024.0 * 1024.0), 2) as total_size_mb,
    round(pg_database_size(current_database()) / (1024.0 * 1024.0 * 1024.0), 2) as total_size_gb;
END;
$$;

-- 2. get_table_sizes
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE (
  schema_name text,
  table_name text,
  size_bytes bigint,
  size_pretty text,
  row_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::text,
    tablename::text,
    pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) as size_bytes,
    pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) as size_pretty,
    (n_live_tup)::bigint as row_count
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) DESC;
END;
$$;

-- 3. get_database_stats
CREATE OR REPLACE FUNCTION public.get_database_stats()
RETURNS TABLE (
  metric text,
  value text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. get_query_performance
CREATE OR REPLACE FUNCTION public.get_query_performance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  cache_hit_ratio numeric;
  total_blks_hit numeric;
  total_blks_read numeric;
BEGIN
  SELECT sum(blks_hit), sum(blks_read)
  INTO total_blks_hit, total_blks_read
  FROM pg_stat_database
  WHERE datname = current_database();

  IF total_blks_hit + total_blks_read > 0 THEN
    cache_hit_ratio := round((total_blks_hit * 100.0 / (total_blks_hit + total_blks_read)), 2);
  ELSE
    cache_hit_ratio := 100.0;
  END IF;

  result := json_build_object(
    'avgQueryTime', 0, 
    'queriesPerSecond', 0,
    'cacheHitRatio', cache_hit_ratio,
    'slowQueries', '[]'::json
  );
  
  RETURN result;
END;
$$;

-- 5. perform_maintenance_task
CREATE OR REPLACE FUNCTION public.perform_maintenance_task(task_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF task_name = 'reset_stats' THEN
    -- Try to reset stats
    PERFORM pg_stat_reset();
    RETURN true;
  END IF;
  
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  -- Log error or just return false
  RAISE WARNING 'Error performing maintenance task %: %', task_name, SQLERRM;
  RETURN false;
END;
$$;

-- Ensure permissions are set
GRANT EXECUTE ON FUNCTION public.get_database_size_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_size_info() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_database_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_stats() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_query_performance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_query_performance() TO service_role;

GRANT EXECUTE ON FUNCTION public.perform_maintenance_task(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perform_maintenance_task(text) TO service_role;
