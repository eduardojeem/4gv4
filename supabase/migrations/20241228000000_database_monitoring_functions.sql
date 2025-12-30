-- Database monitoring functions for Supabase
-- These functions help monitor database size, table sizes, and storage usage

-- Function to get database size information
CREATE OR REPLACE FUNCTION get_database_size_info()
RETURNS TABLE (
  database_name text,
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
    current_database()::text as database_name,
    pg_database_size(current_database()) as total_size_bytes,
    ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) as total_size_mb,
    ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0 / 1024.0, 3) as total_size_gb;
END;
$$;

-- Function to get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
  schema_name text,
  table_name text,
  size_bytes bigint,
  size_mb numeric,
  pretty_size text,
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
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    ROUND(pg_total_relation_size(schemaname||'.'||tablename) / 1024.0 / 1024.0, 2) as size_mb,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as pretty_size,
    COALESCE(
      (SELECT n_tup_ins - n_tup_del 
       FROM pg_stat_user_tables 
       WHERE schemaname = t.schemaname AND tablename = t.tablename), 
      0
    ) as row_count
  FROM pg_tables t
  WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$;

-- Function to get storage usage by category
CREATE OR REPLACE FUNCTION get_storage_usage()
RETURNS TABLE (
  category text,
  size_bytes bigint,
  size_mb numeric,
  percentage numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_db_size bigint;
BEGIN
  -- Get total database size
  SELECT pg_database_size(current_database()) INTO total_db_size;
  
  RETURN QUERY
  WITH storage_data AS (
    SELECT 
      'Tables' as category,
      SUM(pg_total_relation_size(schemaname||'.'||tablename)) as size_bytes
    FROM pg_tables 
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    
    UNION ALL
    
    SELECT 
      'Indexes' as category,
      SUM(pg_indexes_size(schemaname||'.'||tablename)) as size_bytes
    FROM pg_tables 
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  )
  SELECT 
    sd.category,
    sd.size_bytes,
    ROUND(sd.size_bytes / 1024.0 / 1024.0, 2) as size_mb,
    ROUND((sd.size_bytes::numeric / total_db_size::numeric) * 100, 2) as percentage
  FROM storage_data sd
  ORDER BY sd.size_bytes DESC;
END;
$$;

-- Function to get connection and activity stats
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
  metric text,
  value text,
  description text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Active Connections'::text as metric,
    COUNT(*)::text as value,
    'Current number of active database connections'::text as description
  FROM pg_stat_activity 
  WHERE state = 'active'
  
  UNION ALL
  
  SELECT 
    'Total Connections'::text as metric,
    COUNT(*)::text as value,
    'Total number of database connections'::text as description
  FROM pg_stat_activity
  
  UNION ALL
  
  SELECT 
    'Database Age'::text as metric,
    EXTRACT(days FROM (now() - pg_postmaster_start_time()))::text || ' days' as value,
    'Days since database server started'::text as description;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_database_size_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_sizes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_stats() TO authenticated;