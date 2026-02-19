CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM rate_limit_settings
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;
