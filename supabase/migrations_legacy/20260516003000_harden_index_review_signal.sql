-- ============================================================================
-- Harden get_index_stats for safer admin recommendations:
--   - expose structural metadata (PK / UNIQUE / constraint-backed)
--   - expose stats reset timestamp so the UI can reason about confidence
-- Fecha: 2026-05-16
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_index_stats();

CREATE OR REPLACE FUNCTION public.get_index_stats()
RETURNS TABLE (
  table_name text,
  index_name text,
  size_bytes bigint,
  idx_scan bigint,
  idx_tup_read bigint,
  is_primary boolean,
  is_unique boolean,
  is_constraint_backed boolean,
  stats_reset_at timestamptz
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
  WITH current_db AS (
    SELECT stats_reset
    FROM pg_stat_database
    WHERE datname = current_database()
    LIMIT 1
  )
  SELECT
    format('%I.%I', idx.schemaname, idx.relname)::text AS table_name,
    idx.indexrelname::text AS index_name,
    pg_relation_size(idx.indexrelid) AS size_bytes,
    idx.idx_scan::bigint,
    idx.idx_tup_read::bigint,
    ind.indisprimary AS is_primary,
    ind.indisunique AS is_unique,
    EXISTS (
      SELECT 1
      FROM pg_constraint con
      WHERE con.conindid = idx.indexrelid
    ) AS is_constraint_backed,
    current_db.stats_reset AS stats_reset_at
  FROM pg_stat_user_indexes idx
  JOIN pg_index ind ON ind.indexrelid = idx.indexrelid
  CROSS JOIN current_db
  ORDER BY idx.idx_scan ASC, pg_relation_size(idx.indexrelid) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_index_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_index_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_index_stats() TO service_role;
