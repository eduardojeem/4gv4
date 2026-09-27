CREATE OR REPLACE FUNCTION public.close_inactive_sessions()
RETURNS void 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE is_active = TRUE
    AND last_activity < NOW() - INTERVAL '7 days';
END;
$$;
