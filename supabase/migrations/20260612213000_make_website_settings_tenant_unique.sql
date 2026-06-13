-- Make website settings truly tenant-scoped without replacing a modern id PK.
-- Older installations used key as the primary key, which prevented two
-- organizations from storing the same setting name.

DO $$
DECLARE
  fallback_org_id uuid;
BEGIN
  SELECT id
  INTO fallback_org_id
  FROM public.organizations
  ORDER BY (slug = 'default') DESC, id
  LIMIT 1;

  IF fallback_org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot tenant-scope website_settings without an organization';
  END IF;

  UPDATE public.website_settings
  SET organization_id = fallback_org_id
  WHERE organization_id IS NULL;
END $$;

ALTER TABLE public.website_settings
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
DECLARE
  primary_key_name text;
  primary_key_columns text[];
BEGIN
  SELECT
    constraint_name,
    array_agg(column_name::text ORDER BY ordinal_position)
  INTO primary_key_name, primary_key_columns
  FROM information_schema.key_column_usage
  WHERE table_schema = 'public'
    AND table_name = 'website_settings'
    AND constraint_name IN (
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'website_settings'
        AND constraint_type = 'PRIMARY KEY'
    )
  GROUP BY constraint_name;

  IF primary_key_columns = ARRAY['key']::text[] THEN
    EXECUTE format(
      'ALTER TABLE public.website_settings DROP CONSTRAINT %I',
      primary_key_name
    );
    ALTER TABLE public.website_settings
      ADD CONSTRAINT website_settings_pkey PRIMARY KEY (organization_id, key);
  ELSIF primary_key_name IS NULL THEN
    ALTER TABLE public.website_settings
      ADD CONSTRAINT website_settings_pkey PRIMARY KEY (organization_id, key);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_settings_org_key_unique
  ON public.website_settings (organization_id, key);

NOTIFY pgrst, 'reload schema';
