CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND t.tgname = 'update_profiles_updated_at'
  ) THEN
    EXECUTE 'DROP TRIGGER update_profiles_updated_at ON public.profiles';
  END IF;
  EXECUTE 'CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
END $$;
