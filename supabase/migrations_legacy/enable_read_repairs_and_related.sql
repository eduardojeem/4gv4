-- Enable SELECT policies for authenticated users on repairs and related tables

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repairs' AND policyname = 'allow authenticated read repairs'
  ) THEN
    CREATE POLICY "allow authenticated read repairs" ON public.repairs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'allow authenticated read customers'
  ) THEN
    CREATE POLICY "allow authenticated read customers" ON public.customers
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'allow authenticated read profiles'
  ) THEN
    CREATE POLICY "allow authenticated read profiles" ON public.profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

ALTER TABLE public.repairs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;

