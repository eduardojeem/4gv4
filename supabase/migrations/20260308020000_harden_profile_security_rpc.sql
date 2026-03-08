-- ============================================================================
-- Harden profile/security RPCs against parameter tampering
-- - Enforces auth.uid() ownership for session and activity RPCs
-- Fecha: 2026-03-08
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_active_sessions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  session_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
    RAISE EXCEPTION 'Forbidden: cannot read sessions for another user';
  END IF;

  RETURN QUERY
  SELECT
    us.id,
    us.session_id,
    us.user_agent,
    us.ip_address,
    us.device_type,
    us.browser,
    us.os,
    us.country,
    us.city,
    us.is_active,
    us.last_activity,
    us.created_at
  FROM public.user_sessions us
  WHERE us.user_id = v_uid
    AND us.is_active = TRUE
  ORDER BY us.last_activity DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_user_session(p_session_id TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_updated INTEGER;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
    RAISE EXCEPTION 'Forbidden: cannot close sessions for another user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_sessions
    WHERE session_id = p_session_id
      AND user_id = v_uid
      AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_FOUND',
      'message', 'Sesión no encontrada o ya cerrada'
    );
  END IF;

  UPDATE public.user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE session_id = p_session_id
    AND user_id = v_uid
    AND is_active = TRUE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Sesión cerrada correctamente'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'UPDATE_FAILED',
    'message', 'No se pudo cerrar la sesión'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_all_user_sessions_except_current(
  p_user_id UUID,
  p_current_session_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_closed INTEGER;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
    RAISE EXCEPTION 'Forbidden: cannot close sessions for another user';
  END IF;

  UPDATE public.user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE user_id = v_uid
    AND session_id <> p_current_session_id
    AND is_active = TRUE;

  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_activity(
  p_user_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  resource TEXT,
  resource_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ,
  ip_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
    RAISE EXCEPTION 'Forbidden: cannot read activity for another user';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.resource,
    al.resource_id,
    al.new_values AS details,
    al.created_at,
    al.ip_address
  FROM public.audit_log al
  WHERE al.user_id = v_uid
  ORDER BY al.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

