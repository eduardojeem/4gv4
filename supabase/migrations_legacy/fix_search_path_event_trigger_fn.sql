-- Fix search_path for public.event_trigger_fn to avoid mutable search_path issues

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'event_trigger_fn' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.event_trigger_fn() SET search_path = public';
  END IF;
END $$;

