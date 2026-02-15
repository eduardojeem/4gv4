DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN permissions text[] DEFAULT '{}'::text[];
    END IF;
END $$;
