-- ============================================================================
-- Fix monitoring RPC issues detected after rollout:
--   - get_table_sizes referenced a non-existent "tablename" column
--   - record_database_growth_snapshot was not callable by authenticated admins
-- Fecha: 2026-05-16
-- ============================================================================

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
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF session_user NOT IN ('service_role', 'postgres') THEN
    IF v_uid IS NULL OR NOT public.has_permission('settings.read', v_uid) THEN
      RAISE EXCEPTION 'Forbidden: settings.read required';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    stat.schemaname::text AS schema_name,
    stat.relname::text AS table_name,
    pg_total_relation_size(format('%I.%I', stat.schemaname, stat.relname)) AS size_bytes,
    pg_size_pretty(pg_total_relation_size(format('%I.%I', stat.schemaname, stat.relname))) AS size_pretty,
    stat.n_live_tup::bigint AS row_count
  FROM pg_stat_user_tables stat
  ORDER BY pg_total_relation_size(format('%I.%I', stat.schemaname, stat.relname)) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_database_growth_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_database_growth_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_database_growth_snapshot() TO service_role;
