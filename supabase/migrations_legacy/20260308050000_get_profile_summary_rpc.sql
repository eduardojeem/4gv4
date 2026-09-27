-- Function to get profile summary efficiently
-- Consolidates multiple queries into one RPC call

CREATE OR REPLACE FUNCTION get_profile_summary(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSONB;
  v_role TEXT;
  v_stats JSONB;
  v_sales_count INT;
  v_tasks_count INT;
  v_login_streak INT;
  v_last_activity TIMESTAMPTZ;
  v_thirty_days_ago TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
  -- Security check: users can strictly only view their own summary for now
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized access to profile summary';
  END IF;

  -- 1. Get Profile
  SELECT to_jsonb(p.*) INTO v_profile
  FROM profiles p
  WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
     RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- 2. Get Role (Check user_roles table first, then profile)
  BEGIN
    SELECT role INTO v_role
    FROM user_roles
    WHERE user_id = p_user_id
    LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    -- If user_roles table doesn't exist, ignore
    v_role := NULL;
  END;
  
  IF v_role IS NULL THEN
    v_role := v_profile->>'role';
  END IF;

  -- 3. Calculate Stats
  
  -- Total Sales (Last 30 days) - Using created_by
  SELECT COUNT(*) INTO v_sales_count
  FROM sales
  WHERE created_by = p_user_id
    AND created_at >= v_thirty_days_ago;

  -- Completed Tasks (Last 30 days)
  -- Exclude login/sign_in, include other actions
  SELECT COUNT(*) INTO v_tasks_count
  FROM audit_log
  WHERE user_id = p_user_id
    AND created_at >= v_thirty_days_ago
    AND action NOT IN ('login', 'sign_in', 'login_failed');

  -- Login Streak Calculation
  -- Counts consecutive days ending today or yesterday where a login occurred
  WITH distinct_dates AS (
    SELECT DISTINCT date_trunc('day', created_at)::date as day
    FROM audit_log
    WHERE user_id = p_user_id
      AND action IN ('login', 'sign_in')
      AND created_at >= (NOW() - INTERVAL '60 days')
  ),
  groups AS (
    SELECT 
      day,
      day - (ROW_NUMBER() OVER (ORDER BY day) * INTERVAL '1 day')::interval as grp
    FROM distinct_dates
  ),
  latest_streak AS (
      SELECT COUNT(*) as streak
      FROM groups
      WHERE grp = (
        SELECT grp 
        FROM groups 
        ORDER BY day DESC 
        LIMIT 1
      )
      AND day >= (CURRENT_DATE - INTERVAL '1 day') -- Streak must be active (today or yesterday)
  )
  SELECT COALESCE((SELECT streak FROM latest_streak), 0) INTO v_login_streak;

  -- Last Activity Timestamp
  SELECT MAX(ts) INTO v_last_activity
  FROM (
    SELECT created_at as ts FROM sales WHERE created_by = p_user_id
    UNION ALL
    SELECT created_at as ts FROM audit_log WHERE user_id = p_user_id
  ) t;

  -- 4. Construct Result
  v_stats := jsonb_build_object(
    'totalSales', COALESCE(v_sales_count, 0),
    'completedTasks', COALESCE(v_tasks_count, 0),
    'loginStreak', COALESCE(v_login_streak, 0),
    'lastActivity', v_last_activity
  );

  RETURN jsonb_build_object(
    'profile', v_profile,
    'role', v_role,
    'stats', v_stats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_profile_summary(uuid) TO authenticated;
