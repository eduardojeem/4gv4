-- ============================================================================
-- Allow authenticated users to insert their own profile row
-- - Adds self-insert policy for public.profiles using auth.uid()
-- - Supports schema variants: profiles.id or profiles.user_id
-- Fecha: 2026-03-08
-- ============================================================================

DO $$
DECLARE
  has_profiles BOOLEAN;
  has_id BOOLEAN;
  has_user_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) INTO has_profiles;

  IF NOT has_profiles THEN
    RAISE NOTICE 'Skipping profiles self-insert policy: public.profiles does not exist';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) INTO has_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) INTO has_user_id;

  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  GRANT INSERT ON public.profiles TO authenticated;

  IF has_id THEN
    DROP POLICY IF EXISTS profiles_insert_own_by_id ON public.profiles;
    CREATE POLICY profiles_insert_own_by_id
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;

  IF has_user_id THEN
    DROP POLICY IF EXISTS profiles_insert_own_by_user_id ON public.profiles;
    CREATE POLICY profiles_insert_own_by_user_id
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  RAISE NOTICE 'Profiles self-insert policy applied. has_id: %, has_user_id: %', has_id, has_user_id;
END $$;
