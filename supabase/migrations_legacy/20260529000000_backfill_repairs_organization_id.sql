-- Backfill repairs.organization_id from 'default' org to the user's real org.
--
-- Context: 20260601000000_saas_multitenant_foundation.sql created a 'Default
-- Organization' (slug='default') and blindly backfilled ALL rows in every
-- operational table — including repairs — to that org's ID. But users already
-- had their own organization. The repairs API now queries by the user's real
-- org_id and returns 0 results because every repair row is still pinned to
-- 'default'.
--
-- This migration moves repairs from 'default' → the single non-default org
-- that has active members.  It is safe for single-tenant deployments. For
-- genuine multi-tenant setups, review carefully before running.

DO $$
DECLARE
  v_default_org_id   uuid;
  v_real_org_id      uuid;
  v_updated_count    integer;
BEGIN
  -- 1. Locate the 'default' placeholder org created by the foundation migration.
  SELECT id INTO v_default_org_id
  FROM public.organizations
  WHERE slug = 'default'
  LIMIT 1;

  IF v_default_org_id IS NULL THEN
    RAISE NOTICE 'No default org found — nothing to migrate.';
    RETURN;
  END IF;

  -- 2. Find the real org: the first non-default org that has active staff members.
  SELECT DISTINCT om.organization_id INTO v_real_org_id
  FROM public.organization_members om
  WHERE om.organization_id != v_default_org_id
    AND om.status = 'active'
  ORDER BY om.organization_id
  LIMIT 1;

  IF v_real_org_id IS NULL THEN
    -- No separate org exists yet. Fall back: try any non-default org.
    SELECT id INTO v_real_org_id
    FROM public.organizations
    WHERE slug != 'default'
    LIMIT 1;
  END IF;

  IF v_real_org_id IS NULL THEN
    RAISE NOTICE 'No real org found — cannot migrate repairs. Create your organization first.';
    RETURN;
  END IF;

  -- 3. Move repairs from 'default' to the real org.
  UPDATE public.repairs
  SET organization_id = v_real_org_id
  WHERE organization_id = v_default_org_id
     OR organization_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % repair(s) from default org (%) to real org (%).',
    v_updated_count, v_default_org_id, v_real_org_id;

  -- 4. Also migrate related child tables so RLS stays consistent.
  UPDATE public.repair_parts rp
  SET organization_id = v_real_org_id
  FROM public.repairs r
  WHERE rp.repair_id = r.id
    AND r.organization_id = v_real_org_id
    AND (rp.organization_id = v_default_org_id OR rp.organization_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'repair_parts'
        AND column_name = 'organization_id'
    );

  UPDATE public.repair_notes rn
  SET organization_id = v_real_org_id
  FROM public.repairs r
  WHERE rn.repair_id = r.id
    AND r.organization_id = v_real_org_id
    AND (rn.organization_id = v_default_org_id OR rn.organization_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'repair_notes'
        AND column_name = 'organization_id'
    );

  UPDATE public.repair_images ri
  SET organization_id = v_real_org_id
  FROM public.repairs r
  WHERE ri.repair_id = r.id
    AND r.organization_id = v_real_org_id
    AND (ri.organization_id = v_default_org_id OR ri.organization_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'repair_images'
        AND column_name = 'organization_id'
    );

END $$;
