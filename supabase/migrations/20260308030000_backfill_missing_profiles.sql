-- ============================================================================
-- Backfill missing profiles for existing auth users
-- - Creates a profile row for users that do not have one
-- - Handles schema variants (id / user_id and optional columns)
-- Fecha: 2026-03-08
-- ============================================================================

DO $$
DECLARE
  has_profiles BOOLEAN;
  has_auth_users BOOLEAN;

  has_id BOOLEAN;
  has_user_id BOOLEAN;
  has_email BOOLEAN;
  has_full_name BOOLEAN;
  has_name BOOLEAN;
  has_role BOOLEAN;
  has_phone BOOLEAN;
  has_avatar_url BOOLEAN;
  has_timezone BOOLEAN;
  has_social_links BOOLEAN;
  has_created_at BOOLEAN;
  has_updated_at BOOLEAN;

  insert_cols TEXT := '';
  select_cols TEXT := '';
  exists_predicate TEXT := '';
  conflict_target TEXT := '';
  sql_stmt TEXT;
  inserted_count INTEGER := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) INTO has_profiles;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'users'
  ) INTO has_auth_users;

  IF NOT has_profiles OR NOT has_auth_users THEN
    RAISE NOTICE 'Skipping backfill. profiles exists: %, auth.users exists: %', has_profiles, has_auth_users;
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

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) INTO has_full_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name'
  ) INTO has_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) INTO has_phone;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) INTO has_avatar_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'timezone'
  ) INTO has_timezone;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'social_links'
  ) INTO has_social_links;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at'
  ) INTO has_created_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) INTO has_updated_at;

  IF NOT has_id AND NOT has_user_id THEN
    RAISE NOTICE 'Skipping backfill. profiles has neither id nor user_id column';
    RETURN;
  END IF;

  IF has_id THEN
    insert_cols := insert_cols || 'id';
    select_cols := select_cols || 'u.id';
  END IF;

  IF has_user_id THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'user_id';
    select_cols := select_cols || 'u.id';
  END IF;

  IF has_email THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'email';
    select_cols := select_cols || 'u.email';
  END IF;

  IF has_full_name THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'full_name';
    select_cols := select_cols || 'COALESCE(NULLIF(u.raw_user_meta_data->>''full_name'', ''''), split_part(u.email, ''@'', 1), ''Usuario'')';
  END IF;

  IF has_name THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'name';
    select_cols := select_cols || 'COALESCE(NULLIF(u.raw_user_meta_data->>''full_name'', ''''), split_part(u.email, ''@'', 1), ''Usuario'')';
  END IF;

  IF has_role THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'role';
    select_cols := select_cols || 'COALESCE(NULLIF(u.raw_app_meta_data->>''role'', ''''), ''client_normal'')';
  END IF;

  IF has_phone THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'phone';
    select_cols := select_cols || 'NULLIF(u.raw_user_meta_data->>''phone'', '''')';
  END IF;

  IF has_avatar_url THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'avatar_url';
    select_cols := select_cols || 'NULLIF(u.raw_user_meta_data->>''avatar_url'', '''')';
  END IF;

  IF has_timezone THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'timezone';
    select_cols := select_cols || '''America/Asuncion''';
  END IF;

  IF has_social_links THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'social_links';
    select_cols := select_cols || '''{}''::jsonb';
  END IF;

  IF has_created_at THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'created_at';
    select_cols := select_cols || 'NOW()';
  END IF;

  IF has_updated_at THEN
    IF insert_cols <> '' THEN
      insert_cols := insert_cols || ', ';
      select_cols := select_cols || ', ';
    END IF;
    insert_cols := insert_cols || 'updated_at';
    select_cols := select_cols || 'NOW()';
  END IF;

  IF has_id AND has_user_id THEN
    exists_predicate := 'p.id = u.id OR p.user_id = u.id';
    conflict_target := '(id)';
  ELSIF has_id THEN
    exists_predicate := 'p.id = u.id';
    conflict_target := '(id)';
  ELSE
    exists_predicate := 'p.user_id = u.id';
    conflict_target := '(user_id)';
  END IF;

  sql_stmt := format(
    'INSERT INTO public.profiles (%s) '
    || 'SELECT %s FROM auth.users u '
    || 'WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE %s) '
    || 'ON CONFLICT %s DO NOTHING',
    insert_cols,
    select_cols,
    exists_predicate,
    conflict_target
  );

  EXECUTE sql_stmt;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RAISE NOTICE 'Profiles backfill completed. Inserted rows: %', inserted_count;
END $$;
