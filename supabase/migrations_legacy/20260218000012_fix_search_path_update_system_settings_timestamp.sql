CREATE OR REPLACE FUNCTION public.update_system_settings_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$;
