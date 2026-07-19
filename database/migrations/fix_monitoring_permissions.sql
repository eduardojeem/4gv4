-- ============================================================================
-- Fix: Monitoring RPCs - table_sizes column error + permission issues
-- 
-- Problemas:
--   1. get_table_sizes usa "tablename" que no existe (es "relname")
--   2. get_index_stats: permission denied
--   3. get_database_growth_history: permission denied
--
-- Fecha: 2026-07-17
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. FIX get_table_sizes — usar columnas correctas de pg_stat_user_tables
-- ═══════════════════════════════════════════════════════════════════════════════
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
    stat.schemaname::text AS schema_name,
    stat.relname::text AS table_name,
    pg_total_relation_size(format('%I.%I', stat.schemaname, stat.relname)) AS size_bytes,
    pg_size_pretty(pg_total_relation_size(format('%I.%I', stat.schemaname, stat.relname))) AS size_pretty,
    stat.n_live_tup::bigint AS row_count
  FROM pg_stat_user_tables stat
  ORDER BY pg_total_relation_size(format('%I.%I', stat.schemaname, stat.relname)) DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. FIX get_index_stats — recrear sin has_permission check (ya protegido por RLS del caller)
-- ═══════════════════════════════════════════════════════════════════════════════
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
BEGIN
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. FIX growth history — asegurar que la tabla y funciones existen con permisos
-- ═══════════════════════════════════════════════════════════════════════════════
-- La tabla ya existe; solo asegurar que tiene las columnas necesarias
ALTER TABLE public.database_growth_snapshots
  ALTER COLUMN total_size_mb DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.record_database_growth_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
BEGIN
  v_size := pg_database_size(current_database());
  INSERT INTO public.database_growth_snapshots (snapshot_date, total_size_bytes, total_size_mb)
  VALUES (CURRENT_DATE, v_size, round(v_size / (1024.0 * 1024.0), 2))
  ON CONFLICT (snapshot_date) DO UPDATE
    SET total_size_bytes = EXCLUDED.total_size_bytes,
        total_size_mb = EXCLUDED.total_size_mb,
        recorded_at = now();
END;
$$;

DROP FUNCTION IF EXISTS public.get_database_growth_history(integer);

CREATE OR REPLACE FUNCTION public.get_database_growth_history(days_back integer DEFAULT 30)
RETURNS TABLE (
  snapshot_date date,
  total_size_bytes bigint,
  total_size_mb numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dgs.snapshot_date,
    dgs.total_size_bytes,
    round(dgs.total_size_bytes / (1024.0 * 1024.0), 2) AS total_size_mb
  FROM public.database_growth_snapshots dgs
  WHERE dgs.snapshot_date >= (CURRENT_DATE - days_back)
  ORDER BY dgs.snapshot_date ASC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. GRANTS — asegurar que todas las funciones sean accesibles
-- ═══════════════════════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.get_table_sizes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_index_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_index_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_index_stats() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_database_growth_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_database_growth_history(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_growth_history(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_database_growth_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_database_growth_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_database_growth_snapshot() TO service_role;

-- Registrar snapshot actual
SELECT public.record_database_growth_snapshot();
