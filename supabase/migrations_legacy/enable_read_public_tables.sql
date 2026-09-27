-- Grant SELECT access via RLS policies for authenticated users on key tables
-- Safe to run multiple times using DO blocks to avoid duplication

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'allow authenticated read products'
  ) THEN
    CREATE POLICY "allow authenticated read products" ON public.products
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'allow authenticated read categories'
  ) THEN
    CREATE POLICY "allow authenticated read categories" ON public.categories
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = 'allow authenticated read suppliers'
  ) THEN
    CREATE POLICY "allow authenticated read suppliers" ON public.suppliers
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Ensure tables have RLS enabled (idempotent)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

