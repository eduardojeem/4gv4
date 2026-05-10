-- ============================================================================
-- Harden SECURITY DEFINER RPC access
-- - Revoke default PUBLIC execution on exposed functions
-- - Re-grant only the client-facing RPCs that are intentionally callable
-- - Add explicit authorization checks to the most sensitive RPCs
-- Fecha: 2026-05-09
-- ============================================================================

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.archive_old_product_alerts(integer)',
    'public.check_rate_limit(uuid,text,integer,integer)',
    'public.cleanup_old_audit_logs(integer)',
    'public.cleanup_old_rate_limits()',
    'public.close_all_user_sessions_except_current(uuid,text)',
    'public.close_user_session(text,uuid)',
    'public.get_category_stats()',
    'public.get_database_size_info()',
    'public.get_database_stats()',
    'public.get_product_stats()',
    'public.get_products_with_alerts(integer,integer)',
    'public.get_profile_summary(uuid)',
    'public.get_query_performance()',
    'public.get_security_stats(integer)',
    'public.get_storage_usage()',
    'public.get_supplier_stats()',
    'public.get_table_sizes()',
    'public.get_user_active_sessions(uuid)',
    'public.get_user_activity(uuid,integer)',
    'public.get_user_permissions(uuid)',
    'public.get_user_role(uuid)',
    'public.handle_new_user()',
    'public.has_permission(text,uuid)',
    'public.is_email_available(text)',
    'public.log_auth_event(uuid,text,boolean,inet,text,jsonb)',
    'public.log_data_event(uuid,text,text,text,jsonb,jsonb,inet,text)',
    'public.log_repair_status_change()',
    'public.log_settings_change()',
    'public.log_system_event(text,text,jsonb,text,inet)',
    'public.normalize_credit_payment_amount()',
    'public.perform_maintenance_task(text)',
    'public.process_pos_sale(jsonb,jsonb,jsonb)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.close_all_user_sessions_except_current(uuid,text)',
    'public.close_user_session(text,uuid)',
    'public.get_category_stats()',
    'public.get_database_size_info()',
    'public.get_database_stats()',
    'public.get_profile_summary(uuid)',
    'public.get_query_performance()',
    'public.get_security_stats(integer)',
    'public.get_supplier_stats()',
    'public.get_table_sizes()',
    'public.get_user_active_sessions(uuid)',
    'public.get_user_activity(uuid,integer)',
    'public.get_user_permissions(uuid)',
    'public.get_user_role(uuid)',
    'public.has_permission(text,uuid)',
    'public.log_auth_event(uuid,text,boolean,inet,text,jsonb)',
    'public.log_data_event(uuid,text,text,text,jsonb,jsonb,inet,text)',
    'public.process_pos_sale(jsonb,jsonb,jsonb)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.archive_old_product_alerts(integer)',
    'public.check_rate_limit(uuid,text,integer,integer)',
    'public.cleanup_old_audit_logs(integer)',
    'public.cleanup_old_rate_limits()',
    'public.get_product_stats()',
    'public.get_products_with_alerts(integer,integer)',
    'public.get_storage_usage()',
    'public.handle_new_user()',
    'public.is_email_available(text)',
    'public.log_repair_status_change()',
    'public.log_settings_change()',
    'public.log_system_event(text,text,jsonb,text,inet)',
    'public.normalize_credit_payment_amount()',
    'public.perform_maintenance_task(text)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Harden get_user_permissions: self access is allowed, reading others requires
-- elevated user-management privileges.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_role text;
  v_can_read_other_users boolean;
  perms jsonb := '{}'::jsonb;
  perm_row record;
  res text;
  act text;
  parts text[];
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  v_can_read_other_users :=
    public.has_permission('users.manage', v_uid)
    OR public.get_user_role(v_uid) IN ('admin', 'super_admin');

  IF p_user_id <> v_uid AND NOT v_can_read_other_users THEN
    RAISE EXCEPTION 'Forbidden: cannot read permissions for another user';
  END IF;

  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
    AND (is_active IS NULL OR is_active = true)
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM profiles
    WHERE id = p_user_id
    LIMIT 1;
  END IF;

  v_role := COALESCE(v_role, 'cliente');

  IF v_role = 'super_admin' OR v_role = 'admin' THEN
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'products',    jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'inventory',   jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'reports',     jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'settings',    jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'promotions',  jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'sales',       jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'repairs',     jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true)
    );
  ELSIF v_role = 'vendedor' THEN
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'products',    jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false),
      'inventory',   jsonb_build_object('create',false,'read',true,'update',true,'delete',false,'manage',false),
      'reports',     jsonb_build_object('create',true,'read',true,'update',false,'delete',false,'manage',false),
      'settings',    jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'promotions',  jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false),
      'sales',       jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false),
      'repairs',     jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false)
    );
  ELSIF v_role = 'tecnico' THEN
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'products',    jsonb_build_object('create',false,'read',true,'update',true,'delete',false,'manage',false),
      'inventory',   jsonb_build_object('create',false,'read',true,'update',true,'delete',false,'manage',false),
      'reports',     jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'settings',    jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'promotions',  jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'sales',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'repairs',     jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false)
    );
  ELSE
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'products',    jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'inventory',   jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'reports',     jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'settings',    jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'promotions',  jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'sales',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'repairs',     jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false)
    );
  END IF;

  FOR perm_row IN
    SELECT permission
    FROM user_permissions
    WHERE user_id = p_user_id
      AND (is_active IS NULL OR is_active = true)
  LOOP
    parts := string_to_array(perm_row.permission, '.');
    res := parts[1];
    act := parts[2];

    IF res IS NULL OR act IS NULL OR res = '' OR act = '' THEN
      CONTINUE;
    END IF;

    IF NOT (perms ? res) THEN
      perms := perms || jsonb_build_object(
        res,
        jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false)
      );
    END IF;

    IF act = 'manage' THEN
      perms := jsonb_set(perms, ARRAY[res,'create'], 'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'read'],   'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'update'], 'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'delete'], 'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'manage'], 'true'::jsonb, true);
    ELSE
      perms := jsonb_set(perms, ARRAY[res,act], 'true'::jsonb, true);
    END IF;
  END LOOP;

  RETURN perms;
END;
$$;

-- ============================================================================
-- Harden process_pos_sale: requires an authenticated staff user with the
-- sales.create permission.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_sale_data jsonb,
  p_items jsonb,
  p_payments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_customer_id uuid;
  v_total_amount decimal;
  v_payment_method text;
  v_status text;
  v_notes text;
  v_created_at timestamptz;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_permission('sales.create', v_uid) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permissions to process POS sales';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  v_customer_id := (p_sale_data->>'customer_id')::uuid;
  v_total_amount := (p_sale_data->>'total_amount')::decimal;
  v_payment_method := p_sale_data->>'payment_method';
  v_status := COALESCE(p_sale_data->>'status', 'completed');
  v_notes := p_sale_data->>'notes';
  v_created_at := COALESCE((p_sale_data->>'created_at')::timestamptz, NOW());

  INSERT INTO public.sales (
    customer_id,
    total_amount,
    payment_method,
    status,
    notes,
    created_at
  ) VALUES (
    v_customer_id,
    v_total_amount,
    v_payment_method,
    v_status,
    v_notes,
    v_created_at
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      (v_item->>'unit_price')::decimal,
      (v_item->>'subtotal')::decimal
    );

    UPDATE public.products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_sale_id,
    'success', true
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error processing sale: %', SQLERRM;
END;
$$;

-- ============================================================================
-- Harden monitoring RPCs: callable only by service_role/postgres or by users
-- with settings.read (admin monitoring UI).
-- ============================================================================
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
    pg_database_size(current_database()) AS total_size_bytes,
    round(pg_database_size(current_database()) / (1024.0 * 1024.0), 2) AS total_size_mb,
    round(pg_database_size(current_database()) / (1024.0 * 1024.0 * 1024.0), 2) AS total_size_gb;
END;
$$;

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
    schemaname::text,
    tablename::text,
    pg_total_relation_size(schemaname || '.' || tablename) AS size_bytes,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size_pretty,
    (n_live_tup)::bigint AS row_count
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_database_stats()
RETURNS TABLE (
  metric text,
  value text
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
  SELECT 'Active Connections'::text, count(*)::text
  FROM pg_stat_activity
  WHERE state = 'active';

  RETURN QUERY
  SELECT 'Total Connections'::text, count(*)::text
  FROM pg_stat_activity;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_query_performance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  result json;
  cache_hit_ratio numeric;
  total_blks_hit numeric;
  total_blks_read numeric;
BEGIN
  v_uid := auth.uid();

  IF session_user NOT IN ('service_role', 'postgres') THEN
    IF v_uid IS NULL OR NOT public.has_permission('settings.read', v_uid) THEN
      RAISE EXCEPTION 'Forbidden: settings.read required';
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION public.perform_maintenance_task(task_name text)
RETURNS boolean
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

  IF task_name = 'reset_stats' THEN
    PERFORM pg_stat_reset();
    RETURN true;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error performing maintenance task %: %', task_name, SQLERRM;
  RETURN false;
END;
$$;

-- ============================================================================
-- Prevent new public functions from being exposed by default.
-- Future RPCs must opt in with explicit GRANT EXECUTE statements.
-- ============================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
