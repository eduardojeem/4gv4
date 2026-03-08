-- ============================================================================
-- Harden promotions RLS policies
-- - Removes overly permissive policies
-- - Aligns write permissions with dashboard roles
-- Fecha: 2026-03-08
-- ============================================================================

DO $$
DECLARE
  has_promotions BOOLEAN;
  has_profiles BOOLEAN;
  policy_record RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'promotions'
  ) INTO has_promotions;

  IF NOT has_promotions THEN
    RAISE NOTICE 'Skipping promotions RLS hardening: public.promotions does not exist';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) INTO has_profiles;

  ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

  -- Remove all existing policies to avoid leaving permissive access behind.
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'promotions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.promotions', policy_record.policyname);
  END LOOP;

  CREATE POLICY promotions_select_authenticated
    ON public.promotions
    FOR SELECT
    TO authenticated
    USING (true);

  IF has_profiles THEN
    CREATE POLICY promotions_insert_staff
      ON public.promotions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY promotions_update_staff
      ON public.promotions
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY promotions_delete_admin
      ON public.promotions
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
      );
  ELSE
    -- Safe fallback: read-only if profiles table is unavailable.
    CREATE POLICY promotions_insert_staff
      ON public.promotions
      FOR INSERT
      TO authenticated
      WITH CHECK (false);

    CREATE POLICY promotions_update_staff
      ON public.promotions
      FOR UPDATE
      TO authenticated
      USING (false)
      WITH CHECK (false);

    CREATE POLICY promotions_delete_admin
      ON public.promotions
      FOR DELETE
      TO authenticated
      USING (false);
  END IF;

  RAISE NOTICE 'Promotions RLS hardening applied. profiles table found: %', has_profiles;
END $$;
