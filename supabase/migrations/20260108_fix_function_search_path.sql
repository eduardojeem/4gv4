-- Fix search_path for functions to avoid role-based mutable search_path risks

-- Ensure sync_customer_name runs with deterministic search_path
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sync_customer_name' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.sync_customer_name() SET search_path = public';
  END IF;
END $$;

-- Ensure sync_stock_columns runs with deterministic search_path
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sync_stock_columns' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.sync_stock_columns() SET search_path = public';
  END IF;
END $$;

-- Ensure generate_repair_ticket trigger function has deterministic search_path
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_repair_ticket' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.generate_repair_ticket() SET search_path = public';
  END IF;
END $$;

