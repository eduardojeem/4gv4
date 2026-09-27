-- Backfill website_settings.organization_id from 'default' org to the real org.
--
-- Context: 20260601000000_saas_multitenant_foundation.sql set every row in
-- website_settings to organization_id = 'default' org. The tenant RLS
-- migration (20260601009000) then restricted SELECT/UPDATE to rows whose
-- organization_id matches the current user's org. As a result, the admin
-- website settings editor reads zero rows and always shows defaults.
--
-- This migration moves all rows from the 'default' placeholder org to the
-- real org (the first non-default org that has active members).

DO $$
DECLARE
  v_default_org_id uuid;
  v_real_org_id    uuid;
  v_updated_count  integer;
BEGIN
  SELECT id INTO v_default_org_id
  FROM public.organizations
  WHERE slug = 'default'
  LIMIT 1;

  IF v_default_org_id IS NULL THEN
    RAISE NOTICE 'No default org found — nothing to migrate.';
    RETURN;
  END IF;

  SELECT DISTINCT om.organization_id INTO v_real_org_id
  FROM public.organization_members om
  WHERE om.organization_id != v_default_org_id
    AND om.status = 'active'
  ORDER BY om.organization_id
  LIMIT 1;

  IF v_real_org_id IS NULL THEN
    SELECT id INTO v_real_org_id
    FROM public.organizations
    WHERE slug != 'default'
    LIMIT 1;
  END IF;

  IF v_real_org_id IS NULL THEN
    RAISE NOTICE 'No real org found — cannot migrate website_settings.';
    RETURN;
  END IF;

  UPDATE public.website_settings
  SET organization_id = v_real_org_id
  WHERE organization_id = v_default_org_id
     OR organization_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % website_settings row(s) from default org (%) to real org (%).',
    v_updated_count, v_default_org_id, v_real_org_id;
END $$;
