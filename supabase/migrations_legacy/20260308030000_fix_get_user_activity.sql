-- Fix get_user_activity function signature and return types
-- Explicitly cast inet to text to avoid type mismatch errors
-- Ensure parameter names match frontend calls

DROP FUNCTION IF EXISTS public.get_user_activity(uuid, int);

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

  -- Security check: users can only view their own activity
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
    al.ip_address::TEXT -- Explicit cast to match return type
  FROM public.audit_log al
  WHERE al.user_id = v_uid
  ORDER BY al.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_activity(uuid, int) TO authenticated;
