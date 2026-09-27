-- Scope branch uniqueness to each organization so SaaS registration can create
-- a default "principal" branch for every tenant.

DO $$
DECLARE
  default_org_id uuid;
  constraint_record record;
BEGIN
  IF to_regclass('public.branches') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'default'
  LIMIT 1;

  IF default_org_id IS NOT NULL THEN
    UPDATE public.branches
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
  END IF;

  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.branches'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) IN ('UNIQUE (code)', 'UNIQUE (slug)')
  LOOP
    EXECUTE format('ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;

  DROP INDEX IF EXISTS public.idx_branches_single_default;
  DROP INDEX IF EXISTS public.branches_code_key;
  DROP INDEX IF EXISTS public.branches_slug_key;

  IF default_org_id IS NOT NULL THEN
    ALTER TABLE public.branches
      ALTER COLUMN organization_id SET NOT NULL;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_code
    ON public.branches(organization_id, code);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_slug
    ON public.branches(organization_id, slug);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_single_default
    ON public.branches(organization_id)
    WHERE is_default = TRUE;
END $$;
