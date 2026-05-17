-- ============================================================================
-- Complete monitoring backend coverage for:
--   - get_index_stats
--   - get_database_growth_history
--   - persisted daily growth snapshots
-- Fecha: 2026-05-16
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.database_growth_snapshots (
  snapshot_date date PRIMARY KEY,
  total_size_bytes bigint NOT NULL CHECK (total_size_bytes >= 0),
  total_size_mb numeric(14, 2) NOT NULL CHECK (total_size_mb >= 0),
  recorded_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.database_growth_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.database_growth_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.database_growth_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.record_database_growth_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_total_size_bytes bigint;
  v_total_size_mb numeric(14, 2);
BEGIN
  v_uid := auth.uid();

  IF session_user NOT IN ('service_role', 'postgres') THEN
    IF v_uid IS NULL OR NOT public.has_permission('settings.read', v_uid) THEN
      RAISE EXCEPTION 'Forbidden: settings.read required';
    END IF;
  END IF;

  v_total_size_bytes := pg_database_size(current_database());
  v_total_size_mb := round(v_total_size_bytes / (1024.0 * 1024.0), 2);

  INSERT INTO public.database_growth_snapshots (
    snapshot_date,
    total_size_bytes,
    total_size_mb,
    recorded_at,
    updated_at
  ) VALUES (
    current_date,
    v_total_size_bytes,
    v_total_size_mb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (snapshot_date) DO UPDATE
  SET
    total_size_bytes = EXCLUDED.total_size_bytes,
    total_size_mb = EXCLUDED.total_size_mb,
    recorded_at = EXCLUDED.recorded_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_index_stats()
RETURNS TABLE (
  table_name text,
  index_name text,
  size_bytes bigint,
  idx_scan bigint,
  idx_tup_read bigint
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
    format('%I.%I', idx.schemaname, idx.relname)::text AS table_name,
    idx.indexrelname::text AS index_name,
    pg_relation_size(idx.indexrelid) AS size_bytes,
    idx.idx_scan::bigint,
    idx.idx_tup_read::bigint
  FROM pg_stat_user_indexes idx
  ORDER BY idx.idx_scan ASC, pg_relation_size(idx.indexrelid) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_database_growth_history(days_back integer DEFAULT 30)
RETURNS TABLE (
  snapshot_date date,
  total_size_bytes bigint,
  total_size_mb numeric(14, 2),
  recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_days integer;
BEGIN
  v_uid := auth.uid();
  v_days := GREATEST(COALESCE(days_back, 30), 1);

  IF session_user NOT IN ('service_role', 'postgres') THEN
    IF v_uid IS NULL OR NOT public.has_permission('settings.read', v_uid) THEN
      RAISE EXCEPTION 'Forbidden: settings.read required';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    dgs.snapshot_date,
    dgs.total_size_bytes,
    dgs.total_size_mb,
    dgs.recorded_at
  FROM public.database_growth_snapshots dgs
  WHERE dgs.snapshot_date >= current_date - (v_days - 1)
  ORDER BY dgs.snapshot_date ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_database_growth_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_database_growth_snapshot() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_index_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_index_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_index_stats() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_database_growth_history(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_database_growth_history(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_growth_history(integer) TO service_role;

SELECT public.record_database_growth_snapshot();

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'cron'
      AND table_name = 'job'
  ) THEN
    PERFORM cron.unschedule('daily_database_growth_snapshot');
    PERFORM cron.schedule(
      'daily_database_growth_snapshot',
      '15 3 * * *',
      'SELECT public.record_database_growth_snapshot()'
    );
  ELSE
    RAISE NOTICE 'pg_cron is not available; database growth snapshots will rely on manual or application-triggered recording.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule daily_database_growth_snapshot: %', SQLERRM;
END;
$$;
