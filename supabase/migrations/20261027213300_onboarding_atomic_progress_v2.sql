-- Shared onboarding revision, serialized progress writes, and atomic completion.
-- The existing complete_organization_onboarding RPC is intentionally preserved.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS onboarding_revision bigint NOT NULL DEFAULT 0;

-- Every onboarding/settings writer that spans these rows takes locks in this
-- order: organizations -> organization_settings -> branches -> website_settings.
-- Keep the legacy signature because existing callers still use it.
CREATE OR REPLACE FUNCTION public.complete_organization_onboarding(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_currency text,
  p_timezone text,
  p_logo_url text,
  p_modules jsonb,
  p_branch jsonb,
  p_company_info jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  target_branch_id uuid;
  completed_at timestamptz := pg_catalog.now();
  existing_company jsonb;
  merged_company jsonb;
  publication jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = p_organization_id
      AND membership.user_id = p_user_id
      AND membership.status = 'active'
      AND membership.role IN ('owner', 'admin')
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_user_id
      AND profile.role = 'super_admin'
      AND coalesce(profile.status, 'active') NOT IN ('inactive', 'suspended')
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_FORBIDDEN';
  END IF;

  -- Lock the parent first; this also serializes the missing-settings-row case.
  PERFORM 1
  FROM public.organizations AS o
  WHERE o.id = p_organization_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';
  END IF;

  PERFORM 1
  FROM public.organization_settings AS s
  WHERE s.organization_id = p_organization_id
  FOR UPDATE;

  UPDATE public.organizations AS o
  SET name = p_display_name,
      logo_url = nullif(p_logo_url, ''),
      updated_at = completed_at
  WHERE o.id = p_organization_id;

  INSERT INTO public.organization_settings (
    organization_id, display_name, currency, timezone, branding, modules, updated_at
  )
  VALUES (
    p_organization_id, p_display_name, p_currency, p_timezone,
    '{}'::jsonb, coalesce(p_modules, '{}'::jsonb), completed_at
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      currency = EXCLUDED.currency,
      timezone = EXCLUDED.timezone,
      modules = EXCLUDED.modules,
      updated_at = EXCLUDED.updated_at;

  SELECT b.id
  INTO target_branch_id
  FROM public.branches AS b
  WHERE b.organization_id = p_organization_id
    AND (b.is_default = true OR b.slug = 'principal')
  ORDER BY b.is_default DESC, b.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF target_branch_id IS NULL THEN
    INSERT INTO public.branches (
      organization_id, code, name, slug, address, city, phone, email,
      is_active, is_default, metadata, updated_at
    )
    VALUES (
      p_organization_id, 'principal', 'Sucursal principal', 'principal',
      p_branch->>'address', p_branch->>'city',
      nullif(p_branch->>'phone', ''), nullif(p_branch->>'email', ''),
      true, true,
      pg_catalog.jsonb_build_object('onboarding_completed_at', completed_at),
      completed_at
    )
    RETURNING id INTO target_branch_id;
  ELSE
    UPDATE public.branches AS b
    SET address = p_branch->>'address',
        city = p_branch->>'city',
        phone = nullif(p_branch->>'phone', ''),
        email = nullif(p_branch->>'email', ''),
        metadata = coalesce(b.metadata, '{}'::jsonb)
          || pg_catalog.jsonb_build_object('onboarding_completed_at', completed_at),
        updated_at = completed_at
    WHERE b.id = target_branch_id AND b.organization_id = p_organization_id;
  END IF;

  SELECT ws.value INTO existing_company
  FROM public.website_settings AS ws
  WHERE ws.organization_id = p_organization_id AND ws.key = 'company_info'
  FOR UPDATE;

  existing_company := coalesce(existing_company, '{}'::jsonb);
  merged_company := existing_company || coalesce(p_company_info, '{}'::jsonb);

  IF p_company_info ? 'hours' THEN
    merged_company := pg_catalog.jsonb_set(
      merged_company,
      '{hours}',
      coalesce(existing_company->'hours', '{}'::jsonb)
        || coalesce(p_company_info->'hours', '{}'::jsonb)
    );
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'marketplacePublic', o.marketplace_public,
    'storefrontPublic', o.storefront_public
  ) INTO publication
  FROM public.organizations AS o
  WHERE o.id = p_organization_id;

  merged_company := merged_company || coalesce(publication, '{}'::jsonb);

  INSERT INTO public.website_settings (
    organization_id, key, value, updated_by, updated_at
  )
  VALUES (
    p_organization_id, 'company_info', merged_company, p_user_id, completed_at
  )
  ON CONFLICT (organization_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at;

  RETURN pg_catalog.jsonb_build_object(
    'organization_id', p_organization_id,
    'branch_id', target_branch_id,
    'completed_at', completed_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_organization_onboarding(uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_organization_onboarding(uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.save_organization_onboarding_progress_v2(
  p_organization_id uuid,
  p_user_id uuid,
  p_expected_revision bigint,
  p_step integer,
  p_step_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_settings public.organization_settings%ROWTYPE;
  v_modules jsonb;
  v_onboarding jsonb;
  v_state jsonb;
  v_data jsonb;
  v_completed jsonb;
  v_step_key text;
  v_branch_id uuid;
  v_branch jsonb;
  v_next_step integer;
  v_revision bigint;
  v_old_category text;
  v_new_category text;
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organization_members AS m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = p_user_id AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = p_user_id AND p.role = 'super_admin'
        AND coalesce(p.status, 'active') NOT IN ('inactive', 'suspended')
    )
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_step IS NULL OR p_step NOT IN (2, 3, 4)
     OR pg_catalog.jsonb_typeof(p_step_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ONBOARDING_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.organizations AS o
  WHERE o.id = p_organization_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.* INTO v_settings
  FROM public.organization_settings AS s
  WHERE s.organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_SETTINGS_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_settings.onboarding_revision <> p_expected_revision THEN
    -- Business-level stale writes are returned as a stable JSON contract; they
    -- are not PostgreSQL serialization/deadlock errors (40001 or 40P01).
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'ONBOARDING_REVISION_CONFLICT',
      'revision', v_settings.onboarding_revision,
      'setupState', v_settings.modules #> '{onboarding,shared}'
    );
  END IF;

  v_modules := CASE WHEN pg_catalog.jsonb_typeof(v_settings.modules) = 'object'
                    THEN v_settings.modules ELSE '{}'::jsonb END;
  v_onboarding := CASE WHEN pg_catalog.jsonb_typeof(v_modules->'onboarding') = 'object'
                       THEN v_modules->'onboarding' ELSE '{}'::jsonb END;
  v_state := v_onboarding->'shared';
  IF pg_catalog.jsonb_typeof(v_state) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ONBOARDING_NOT_ENABLED' USING ERRCODE = '22023';
  END IF;
  IF v_onboarding->>'status' = 'completed' OR v_state->>'completed' = 'true' THEN
    RAISE EXCEPTION 'ONBOARDING_ALREADY_COMPLETED' USING ERRCODE = '22023';
  END IF;

  v_data := CASE WHEN pg_catalog.jsonb_typeof(v_state->'data') = 'object'
                 THEN v_state->'data' ELSE '{}'::jsonb END;
  v_completed := CASE WHEN pg_catalog.jsonb_typeof(v_state->'completedSteps') = 'array'
                      THEN v_state->'completedSteps' ELSE '[]'::jsonb END;

  IF p_step = 2 THEN
    v_old_category := v_data->>'businessCategory';
    v_new_category := p_step_payload->>'businessCategory';
    v_data := v_data || p_step_payload;
    IF v_old_category IS DISTINCT FROM v_new_category THEN
      v_data := pg_catalog.jsonb_set(v_data, '{selectedModules}', 'null'::jsonb, true);
      SELECT coalesce(pg_catalog.jsonb_agg(step.value), '[]'::jsonb)
      INTO v_completed
      FROM pg_catalog.jsonb_array_elements(v_completed) AS step(value)
      WHERE step.value #>> '{}' NOT IN ('modules', 'ready');
    END IF;
    v_step_key := 'business';
    v_next_step := 3;
  ELSIF p_step = 3 THEN
    IF pg_catalog.length(pg_catalog.btrim(coalesce(p_step_payload->>'name', ''))) < 2
       OR pg_catalog.length(pg_catalog.btrim(coalesce(p_step_payload->>'city', ''))) < 2 THEN
      RAISE EXCEPTION 'ONBOARDING_INVALID_BRANCH' USING ERRCODE = '22023';
    END IF;

    SELECT b.id INTO v_branch_id
    FROM public.branches AS b
    WHERE b.organization_id = p_organization_id
      AND (b.is_default OR b.slug = 'principal')
    ORDER BY b.is_default DESC, b.created_at ASC
    LIMIT 1 FOR UPDATE;

    IF v_branch_id IS NULL THEN
      INSERT INTO public.branches (
        organization_id, code, name, slug, address, city, phone, email,
        is_active, is_default, updated_at
      ) VALUES (
        p_organization_id, 'principal', pg_catalog.btrim(p_step_payload->>'name'), 'principal',
        nullif(pg_catalog.btrim(coalesce(p_step_payload->>'address', '')), ''),
        pg_catalog.btrim(p_step_payload->>'city'),
        nullif(pg_catalog.btrim(coalesce(p_step_payload->>'phone', '')), ''),
        nullif(pg_catalog.btrim(coalesce(p_step_payload->>'email', '')), ''),
        true, true, pg_catalog.now()
      ) RETURNING id INTO v_branch_id;
    ELSE
      UPDATE public.branches AS b SET
        name = pg_catalog.btrim(p_step_payload->>'name'),
        address = nullif(pg_catalog.btrim(coalesce(p_step_payload->>'address', '')), ''),
        city = pg_catalog.btrim(p_step_payload->>'city'),
        phone = nullif(pg_catalog.btrim(coalesce(p_step_payload->>'phone', '')), ''),
        email = nullif(pg_catalog.btrim(coalesce(p_step_payload->>'email', '')), ''),
        is_active = true,
        is_default = true,
        updated_at = pg_catalog.now()
      WHERE b.id = v_branch_id AND b.organization_id = p_organization_id;
    END IF;

    v_branch := p_step_payload || pg_catalog.jsonb_build_object('id', v_branch_id);
    v_data := pg_catalog.jsonb_set(v_data, '{primaryBranch}', v_branch, true);
    v_step_key := 'branch';
    v_next_step := 4;
  ELSE
    IF pg_catalog.jsonb_typeof(p_step_payload->'selectedModules') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'ONBOARDING_INVALID_MODULES' USING ERRCODE = '22023';
    END IF;
    v_data := pg_catalog.jsonb_set(v_data, '{selectedModules}', p_step_payload->'selectedModules', true);
    v_step_key := 'modules';
    v_next_step := 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements_text(v_completed) AS step(value)
    WHERE step.value = v_step_key
  ) THEN
    v_completed := v_completed || pg_catalog.jsonb_build_array(v_step_key);
  END IF;
  v_state := pg_catalog.jsonb_set(v_state, '{data}', v_data, true);
  v_state := pg_catalog.jsonb_set(v_state, '{completedSteps}', v_completed, true);
  v_state := pg_catalog.jsonb_set(v_state, '{currentStep}', pg_catalog.to_jsonb(v_next_step), true);
  v_onboarding := v_onboarding || pg_catalog.jsonb_build_object('shared', v_state, 'status', 'in_progress');
  v_modules := pg_catalog.jsonb_set(v_modules, '{onboarding}', v_onboarding, true);

  UPDATE public.organization_settings AS s
  SET modules = v_modules,
      onboarding_revision = s.onboarding_revision + 1,
      updated_at = pg_catalog.now()
  WHERE s.organization_id = p_organization_id
  RETURNING s.onboarding_revision INTO v_revision;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'revision', v_revision, 'setupState', v_state);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_organization_onboarding_v2(
  p_organization_id uuid,
  p_user_id uuid,
  p_expected_revision bigint,
  p_display_name text,
  p_currency text,
  p_timezone text,
  p_country_code text,
  p_locale text,
  p_logo_url text,
  p_branch jsonb,
  p_company_info jsonb,
  p_admin_settings jsonb,
  p_organization_profile jsonb,
  p_storefront_public boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_settings public.organization_settings%ROWTYPE;
  v_modules jsonb;
  v_onboarding jsonb;
  v_shared jsonb;
  v_completed jsonb;
  v_now timestamptz := pg_catalog.now();
  v_revision bigint;
  v_completion jsonb;
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organization_members AS m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = p_user_id AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = p_user_id AND p.role = 'super_admin'
        AND coalesce(p.status, 'active') NOT IN ('inactive', 'suspended')
    )
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0
     OR pg_catalog.jsonb_typeof(p_admin_settings) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_organization_profile) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_branch) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_company_info) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ONBOARDING_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.organizations AS o
  WHERE o.id = p_organization_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.* INTO v_settings
  FROM public.organization_settings AS s
  WHERE s.organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_SETTINGS_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_settings.onboarding_revision <> p_expected_revision THEN
    -- Keep stale-revision signaling separate from database concurrency errors.
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'ONBOARDING_REVISION_CONFLICT',
      'revision', v_settings.onboarding_revision,
      'setupState', v_settings.modules #> '{onboarding,shared}'
    );
  END IF;

  v_modules := CASE WHEN pg_catalog.jsonb_typeof(v_settings.modules) = 'object'
                    THEN v_settings.modules ELSE '{}'::jsonb END;
  v_onboarding := CASE WHEN pg_catalog.jsonb_typeof(v_modules->'onboarding') = 'object'
                       THEN v_modules->'onboarding' ELSE '{}'::jsonb END;
  v_shared := v_onboarding->'shared';
  IF pg_catalog.jsonb_typeof(v_shared) IS DISTINCT FROM 'object'
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements_text(
         CASE WHEN pg_catalog.jsonb_typeof(v_shared->'completedSteps') = 'array'
              THEN v_shared->'completedSteps' ELSE '[]'::jsonb END
       ) AS step(value) WHERE step.value = 'modules'
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements_text(
         CASE WHEN pg_catalog.jsonb_typeof(v_shared->'completedSteps') = 'array'
              THEN v_shared->'completedSteps' ELSE '[]'::jsonb END
       ) AS step(value) WHERE step.value = 'business'
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements_text(
         CASE WHEN pg_catalog.jsonb_typeof(v_shared->'completedSteps') = 'array'
              THEN v_shared->'completedSteps' ELSE '[]'::jsonb END
       ) AS step(value) WHERE step.value = 'branch'
     )
     OR coalesce(v_shared->'data'->>'businessName', '') = ''
     OR coalesce(v_shared->'data'->>'countryCode', '') = ''
     OR coalesce(v_shared->'data'->>'locale', '') = ''
     OR coalesce(v_shared->'data'->>'currency', '') = ''
     OR coalesce(v_shared->'data'->>'timezone', '') = ''
     OR coalesce(v_shared->'data'->'primaryBranch'->>'name', '') = ''
     OR coalesce(v_shared->'data'->'primaryBranch'->>'city', '') = ''
     OR coalesce(v_shared->'data'->'selectedModules', 'null'::jsonb) = 'null'::jsonb THEN
    RAISE EXCEPTION 'ONBOARDING_INCOMPLETE' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_typeof(v_shared->'data'->'selectedModules') IS DISTINCT FROM 'array'
     OR p_display_name IS DISTINCT FROM (v_shared->'data'->>'businessName')
     OR p_country_code IS DISTINCT FROM (v_shared->'data'->>'countryCode')
     OR p_locale IS DISTINCT FROM (v_shared->'data'->>'locale')
     OR p_currency IS DISTINCT FROM (v_shared->'data'->>'currency')
     OR p_timezone IS DISTINCT FROM (v_shared->'data'->>'timezone')
     OR p_branch->>'name' IS DISTINCT FROM (v_shared->'data'->'primaryBranch'->>'name')
     OR p_branch->>'city' IS DISTINCT FROM (v_shared->'data'->'primaryBranch'->>'city') THEN
    RAISE EXCEPTION 'ONBOARDING_CANONICAL_DATA_MISMATCH' USING ERRCODE = '22023';
  END IF;

  v_completed := CASE WHEN pg_catalog.jsonb_typeof(v_shared->'completedSteps') = 'array'
                      THEN v_shared->'completedSteps' ELSE '[]'::jsonb END;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements_text(v_completed) AS s(value) WHERE s.value = 'ready') THEN
    v_completed := v_completed || pg_catalog.jsonb_build_array('ready');
  END IF;
  v_shared := pg_catalog.jsonb_set(v_shared, '{completed}', 'true'::jsonb, true);
  v_shared := pg_catalog.jsonb_set(v_shared, '{completedAt}', pg_catalog.to_jsonb(v_now), true);
  v_shared := pg_catalog.jsonb_set(v_shared, '{currentStep}', '5'::jsonb, true);
  v_shared := pg_catalog.jsonb_set(v_shared, '{completedSteps}', v_completed, true);

  v_onboarding := v_onboarding || pg_catalog.jsonb_build_object(
    'status', 'completed',
    'completed_at', coalesce(v_onboarding->'completed_at', pg_catalog.to_jsonb(v_now)),
    'completed_by', coalesce(v_onboarding->'completed_by', pg_catalog.to_jsonb(p_user_id)),
    'last_updated_at', pg_catalog.to_jsonb(v_now),
    'last_updated_by', pg_catalog.to_jsonb(p_user_id),
    'shared', v_shared
  );
  v_modules := v_modules || pg_catalog.jsonb_build_object(
    'admin_settings',
      (CASE WHEN pg_catalog.jsonb_typeof(v_modules->'admin_settings') = 'object'
            THEN v_modules->'admin_settings' ELSE '{}'::jsonb END) || p_admin_settings,
    'onboarding', v_onboarding
  );

  -- The legacy RPC copies these canonical publication values into company_info.
  -- Set them inside this transaction before calling it so both stores agree.
  UPDATE public.organizations AS o
  SET storefront_public = p_storefront_public,
      marketplace_public = CASE WHEN p_storefront_public THEN o.marketplace_public ELSE false END,
      updated_at = v_now
  WHERE o.id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- This existing function performs the established organization/settings,
  -- primary-branch and website-company-info writes inside this same transaction.
  v_completion := public.complete_organization_onboarding(
    p_organization_id, p_user_id, p_display_name, p_currency, p_timezone,
    p_logo_url, v_modules, p_branch, p_company_info
  );

  UPDATE public.organization_settings AS s
  SET country_code = p_country_code,
      locale = p_locale,
      updated_at = v_now
  WHERE s.organization_id = p_organization_id;

  UPDATE public.organizations AS o
  SET business_vertical = coalesce(p_organization_profile->>'business_vertical', o.business_vertical),
      operating_model = coalesce(p_organization_profile->>'operating_model', o.operating_model),
      enabled_modules = CASE WHEN p_organization_profile ? 'enabled_modules'
        THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(p_organization_profile->'enabled_modules'))
        ELSE o.enabled_modules END,
      service_specialties = CASE WHEN p_organization_profile ? 'service_specialties'
        THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(p_organization_profile->'service_specialties'))
        ELSE o.service_specialties END,
      attention_mode = CASE WHEN p_organization_profile ? 'attention_mode'
        THEN p_organization_profile->>'attention_mode' ELSE o.attention_mode END,
      appointment_mode = CASE WHEN p_organization_profile ? 'appointment_mode'
        THEN p_organization_profile->>'appointment_mode' ELSE o.appointment_mode END,
      storefront_public = p_storefront_public,
      marketplace_public = CASE WHEN p_storefront_public THEN o.marketplace_public ELSE false END,
      updated_at = v_now
  WHERE o.id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Revision changes last, after every canonical finalization write succeeded.
  UPDATE public.organization_settings AS s
  SET onboarding_revision = s.onboarding_revision + 1,
      updated_at = v_now
  WHERE s.organization_id = p_organization_id
  RETURNING s.onboarding_revision INTO v_revision;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'revision', v_revision,
    'completed_at', coalesce(v_completion->'completed_at', pg_catalog.to_jsonb(v_now)),
    'branch_id', v_completion->'branch_id',
    'setupState', v_shared
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_organization_admin_settings_v2(
  p_organization_id uuid,
  p_user_id uuid,
  p_settings jsonb,
  p_admin_settings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_modules jsonb;
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organization_members AS m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = p_user_id AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = p_user_id AND p.role = 'super_admin'
        AND coalesce(p.status, 'active') NOT IN ('inactive', 'suspended')
    )
  ) THEN
    RAISE EXCEPTION 'ORGANIZATION_SETTINGS_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.jsonb_typeof(p_settings) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_admin_settings) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ORGANIZATION_SETTINGS_INVALID' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.organizations AS o
  WHERE o.id = p_organization_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.organization_settings AS s
  WHERE s.organization_id = p_organization_id
  FOR UPDATE;

  INSERT INTO public.organization_settings (
    organization_id, display_name, currency, timezone, country_code, locale,
    repair_max_discount_percent, repair_labor_tax_rate, modules, updated_at
  ) VALUES (
    p_organization_id,
    p_settings->>'display_name',
    coalesce(p_settings->>'currency', 'PYG'),
    coalesce(p_settings->>'timezone', 'America/Asuncion'),
    p_settings->>'country_code', p_settings->>'locale',
    coalesce((p_settings->>'repair_max_discount_percent')::numeric, 20),
    coalesce((p_settings->>'repair_labor_tax_rate')::numeric, 10),
    pg_catalog.jsonb_build_object('admin_settings', p_admin_settings),
    pg_catalog.now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    country_code = EXCLUDED.country_code,
    locale = EXCLUDED.locale,
    repair_max_discount_percent = EXCLUDED.repair_max_discount_percent,
    repair_labor_tax_rate = EXCLUDED.repair_labor_tax_rate,
    modules = pg_catalog.jsonb_set(
      CASE WHEN pg_catalog.jsonb_typeof(public.organization_settings.modules) = 'object'
           THEN public.organization_settings.modules ELSE '{}'::jsonb END,
      '{admin_settings}',
      (CASE WHEN pg_catalog.jsonb_typeof(public.organization_settings.modules->'admin_settings') = 'object'
            THEN public.organization_settings.modules->'admin_settings' ELSE '{}'::jsonb END) || p_admin_settings,
      true
    ),
    updated_at = pg_catalog.now();

  UPDATE public.organizations AS o
  SET name = coalesce(nullif(p_settings->>'display_name', ''), o.name),
      updated_at = pg_catalog.now()
  WHERE o.id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.modules INTO v_modules
  FROM public.organization_settings AS s
  WHERE s.organization_id = p_organization_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'modules', v_modules);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_organization_onboarding_progress_v2(uuid, uuid, bigint, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_organization_onboarding_v2(uuid, uuid, bigint, text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_organization_admin_settings_v2(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_organization_onboarding_progress_v2(uuid, uuid, bigint, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_organization_onboarding_v2(uuid, uuid, bigint, text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_organization_admin_settings_v2(uuid, uuid, jsonb, jsonb) TO service_role;

COMMENT ON COLUMN public.organization_settings.onboarding_revision IS
  'Monotonic revision for shared onboarding writes only; unrelated setting updates do not advance it.';
