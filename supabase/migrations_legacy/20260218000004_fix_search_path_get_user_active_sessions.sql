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
BEGIN
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
  FROM user_sessions us
  WHERE us.user_id = p_user_id
    AND us.is_active = TRUE
  ORDER BY us.last_activity DESC;
END;
$$;
