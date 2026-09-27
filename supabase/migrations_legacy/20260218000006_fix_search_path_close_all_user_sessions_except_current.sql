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
  v_closed INTEGER;
BEGIN
  UPDATE user_sessions
  SET is_active = FALSE,
      ended_at = NOW()
  WHERE user_id = p_user_id
    AND session_id != p_current_session_id
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;
