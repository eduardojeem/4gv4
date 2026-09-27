-- ============================================================================
-- Replace placeholder query performance monitoring with pg_stat_statements data
-- Fecha: 2026-05-16
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.get_query_performance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_result json;
  v_cache_hit_ratio numeric;
  v_total_blks_hit numeric;
  v_total_blks_read numeric;
  v_total_calls bigint;
  v_total_exec_time numeric;
  v_avg_query_time numeric;
  v_queries_per_second numeric;
  v_stats_reset timestamptz;
  v_elapsed_seconds numeric;
  v_slow_queries json;
BEGIN
  v_uid := auth.uid();

  IF session_user NOT IN ('service_role', 'postgres') THEN
    IF v_uid IS NULL OR NOT public.has_permission('settings.read', v_uid) THEN
      RAISE EXCEPTION 'Forbidden: settings.read required';
    END IF;
  END IF;

  SELECT sum(blks_hit), sum(blks_read)
  INTO v_total_blks_hit, v_total_blks_read
  FROM pg_stat_database
  WHERE datname = current_database();

  IF COALESCE(v_total_blks_hit, 0) + COALESCE(v_total_blks_read, 0) > 0 THEN
    v_cache_hit_ratio := round(
      (COALESCE(v_total_blks_hit, 0) * 100.0 / (COALESCE(v_total_blks_hit, 0) + COALESCE(v_total_blks_read, 0))),
      2
    );
  ELSE
    v_cache_hit_ratio := NULL;
  END IF;

  SELECT
    sum(statements.calls)::bigint,
    sum(statements.total_exec_time),
    CASE
      WHEN sum(statements.calls) > 0 THEN round((sum(statements.total_exec_time) / sum(statements.calls))::numeric, 2)
      ELSE NULL
    END
  INTO v_total_calls, v_total_exec_time, v_avg_query_time
  FROM extensions.pg_stat_statements statements
  WHERE statements.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND statements.calls > 0;

  BEGIN
    SELECT info.stats_reset
    INTO v_stats_reset
    FROM extensions.pg_stat_statements_info info;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_stats_reset := NULL;
  END;

  v_elapsed_seconds := EXTRACT(
    epoch FROM (
      timezone('utc'::text, now()) - COALESCE(v_stats_reset, pg_postmaster_start_time())
    )
  );

  IF v_total_calls IS NOT NULL AND v_total_calls > 0 AND v_elapsed_seconds > 0 THEN
    v_queries_per_second := round((v_total_calls / v_elapsed_seconds)::numeric, 4);
  ELSE
    v_queries_per_second := NULL;
  END IF;

  SELECT COALESCE(
    json_agg(row_to_json(slow_query_row)),
    '[]'::json
  )
  INTO v_slow_queries
  FROM (
    SELECT
      left(regexp_replace(statements.query, '\s+', ' ', 'g'), 600)::text AS query,
      round(statements.mean_exec_time::numeric, 2) AS duration,
      timezone('utc'::text, now()) AS "timestamp",
      statements.calls::bigint AS frequency
    FROM extensions.pg_stat_statements statements
    WHERE statements.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND statements.calls > 0
      AND statements.query NOT ILIKE '%pg_stat_statements%'
      AND statements.query NOT ILIKE '%get_query_performance%'
      AND statements.query NOT ILIKE '%record_database_growth_snapshot%'
    ORDER BY statements.mean_exec_time DESC, statements.calls DESC
    LIMIT 5
  ) AS slow_query_row;

  v_result := json_build_object(
    'avgQueryTime', v_avg_query_time,
    'queriesPerSecond', v_queries_per_second,
    'cacheHitRatio', v_cache_hit_ratio,
    'slowQueries', v_slow_queries
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_query_performance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_query_performance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_query_performance() TO service_role;
