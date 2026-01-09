-- Fix search_path for role-check functions to avoid mutable search_path warnings

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path = public';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_manager' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_manager() SET search_path = public';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_cashier' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_cashier() SET search_path = public';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_technician' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_technician() SET search_path = public';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_staff' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_staff() SET search_path = public';
  END IF;
END $$;

