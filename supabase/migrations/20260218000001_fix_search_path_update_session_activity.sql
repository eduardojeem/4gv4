CREATE OR REPLACE FUNCTION public.update_session_activity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$;
