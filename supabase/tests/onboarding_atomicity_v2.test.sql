-- Run only against an isolated Supabase Local database. All fixtures roll back.
BEGIN;
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_legacy_org uuid := gen_random_uuid();
  v_result jsonb;
  v_state jsonb;
  v_revision bigint;
  v_branch_count integer;
  v_before_state jsonb;
  v_after_state jsonb;
  v_failed boolean := false;
  v_failure_message text;
BEGIN
  INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_user, 'onboarding-atomic-' || v_user::text || '@example.invalid', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_other_user, 'onboarding-other-' || v_other_user::text || '@example.invalid', now(), now(), '{}'::jsonb, '{}'::jsonb);
  INSERT INTO public.organizations (id, name, slug, owner_id)
  VALUES (v_org, 'Synthetic Onboarding', 'onboarding-' || left(v_org::text, 24), v_user);
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org, v_user, 'owner', 'active');
  INSERT INTO public.organization_settings (organization_id, display_name, modules)
  VALUES (
    v_org,
    'Synthetic Onboarding',
    '{"payments":{"cash":true},"admin_settings":{"companyPhone":"old"},"onboarding":{"status":"in_progress","shared":{"currentStep":2,"completedSteps":["region"],"data":{"selectedModules":null}}}}'::jsonb
  );

  IF (SELECT onboarding_revision FROM public.organization_settings WHERE organization_id = v_org) <> 0 THEN
    RAISE EXCEPTION 'REVISION_DEFAULT_NOT_ZERO';
  END IF;

  v_result := public.save_organization_onboarding_progress_v2(
    v_org, v_user, 0, 2,
    '{"businessName":"Synthetic Shop","countryCode":"PY","businessCategory":"general","currency":"PYG","timezone":"America/Asuncion","locale":"es-PY","regionalConfirmed":true}'::jsonb
  );
  IF (v_result->>'revision')::bigint <> 1 THEN RAISE EXCEPTION 'BUSINESS_SAVE_REVISION'; END IF;
  IF NOT (SELECT modules ? 'payments' AND modules->'admin_settings'->>'companyPhone' = 'old'
          FROM public.organization_settings WHERE organization_id = v_org) THEN
    RAISE EXCEPTION 'PROGRESS_OVERWROTE_UNRELATED_MODULES';
  END IF;

  -- A stale client gets the newest snapshot and cannot mutate progress or create a branch.
  v_result := public.save_organization_onboarding_progress_v2(
    v_org, v_user, 0, 3, '{"name":"Stale branch","city":"Asuncion"}'::jsonb
  );
  IF v_result->>'code' <> 'ONBOARDING_REVISION_CONFLICT' OR (v_result->>'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'STALE_REVISION_NOT_REJECTED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branches WHERE organization_id = v_org) THEN
    RAISE EXCEPTION 'STALE_REQUEST_CREATED_BRANCH';
  END IF;

  v_result := public.save_organization_onboarding_progress_v2(
    v_org, v_user, 1, 3, '{"name":"Principal","city":"Asuncion","address":"Synthetic address"}'::jsonb
  );
  IF (v_result->>'revision')::bigint <> 2 THEN RAISE EXCEPTION 'BRANCH_SAVE_REVISION'; END IF;
  v_result := public.save_organization_onboarding_progress_v2(
    v_org, v_user, 2, 3, '{"name":"Principal","city":"Asuncion","address":"Synthetic address"}'::jsonb
  );
  IF (SELECT count(*) FROM public.branches WHERE organization_id = v_org AND (is_default OR slug = 'principal')) <> 1 THEN
    RAISE EXCEPTION 'PRIMARY_BRANCH_NOT_IDEMPOTENT';
  END IF;

  v_result := public.save_organization_onboarding_progress_v2(
    v_org, v_user, 3, 4, '{"selectedModules":["inventory"]}'::jsonb
  );
  IF (v_result->>'revision')::bigint <> 4 THEN RAISE EXCEPTION 'MODULE_SAVE_REVISION'; END IF;

  -- Admin settings do not advance onboarding revision and merge only their JSON subtree.
  PERFORM public.merge_organization_admin_settings_v2(
    v_org, v_user,
    '{"display_name":"Synthetic Shop","currency":"PYG","timezone":"America/Asuncion","country_code":"PY","locale":"es-PY","repair_max_discount_percent":20,"repair_labor_tax_rate":10}'::jsonb,
    '{"companyPhone":"new"}'::jsonb
  );
  SELECT modules->'onboarding'->'shared', onboarding_revision INTO v_state, v_revision
  FROM public.organization_settings WHERE organization_id = v_org;
  IF v_revision <> 4 OR v_state->'data'->>'businessName' <> 'Synthetic Shop'
     OR (SELECT modules->'admin_settings'->>'companyPhone' FROM public.organization_settings WHERE organization_id = v_org) <> 'new'
     OR NOT (SELECT modules ? 'payments' FROM public.organization_settings WHERE organization_id = v_org) THEN
    RAISE EXCEPTION 'ADMIN_SETTINGS_MERGE_LOST_PROGRESS_OR_UNRELATED_MODULES';
  END IF;

  -- A caller without active organization membership cannot use the service-only RPC contract.
  BEGIN
    PERFORM public.save_organization_onboarding_progress_v2(
      v_org, v_other_user, 4, 2, '{"businessName":"forged"}'::jsonb
    );
    RAISE EXCEPTION 'UNAUTHORIZED_PROGRESS_WRITE_ACCEPTED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  v_result := public.complete_organization_onboarding_v2(
    v_org, v_user, 4, 'Synthetic Shop', 'PYG', 'America/Asuncion', 'PY', 'es-PY', '',
    '{"name":"Principal","city":"Asuncion","address":"Synthetic address","phone":""}'::jsonb,
    '{"name":"Synthetic Shop","hours":{"weekdays":"09:00-18:00"}}'::jsonb,
    '{"companyPhone":"new"}'::jsonb,
    '{"business_vertical":"general","operating_model":"retail","enabled_modules":["inventory"],"service_specialties":[]}'::jsonb,
    true
  );
  IF (v_result->>'revision')::bigint <> 5 THEN RAISE EXCEPTION 'COMPLETION_REVISION_NOT_INCREMENTED'; END IF;
  SELECT onboarding_revision, modules->'onboarding'->'shared'
    INTO v_revision, v_state FROM public.organization_settings WHERE organization_id = v_org;
  IF v_revision <> 5 OR v_state->>'completed' <> 'true' OR v_state->>'currentStep' <> '5'
     OR (SELECT country_code FROM public.organization_settings WHERE organization_id = v_org) <> 'PY'
     OR (SELECT locale FROM public.organization_settings WHERE organization_id = v_org) <> 'es-PY'
     OR (SELECT storefront_public FROM public.organizations WHERE id = v_org) IS DISTINCT FROM true
     OR (SELECT value->>'storefrontPublic' FROM public.website_settings WHERE organization_id = v_org AND key = 'company_info') <> 'true' THEN
    RAISE EXCEPTION 'COMPLETION_CANONICAL_STATE_MISMATCH';
  END IF;
  SELECT count(*) INTO v_branch_count FROM public.branches WHERE organization_id = v_org AND (is_default OR slug = 'principal');
  IF v_branch_count <> 1 THEN RAISE EXCEPTION 'COMPLETION_DUPLICATED_PRIMARY_BRANCH'; END IF;

  -- Fail after the legacy RPC has written settings, organization, branch and website rows.
  -- The completion call must roll all of them back as one statement.
  EXECUTE $ddl$
    CREATE FUNCTION pg_temp.fail_onboarding_completion_profile()
    RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN RAISE EXCEPTION 'SYNTHETIC_COMPLETION_FAILURE'; END;
    $body$
  $ddl$;
  EXECUTE 'CREATE TRIGGER onboarding_atomicity_synthetic_failure
    BEFORE UPDATE OF service_specialties ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_onboarding_completion_profile()';
  SELECT pg_catalog.jsonb_build_object(
    'organization', (SELECT pg_catalog.to_jsonb(o) FROM public.organizations AS o WHERE o.id = v_org),
    'organization_settings', (SELECT pg_catalog.to_jsonb(s) FROM public.organization_settings AS s WHERE s.organization_id = v_org),
    'primary_branches', coalesce((
      SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) ORDER BY b.is_default DESC, b.created_at ASC)
      FROM public.branches AS b
      WHERE b.organization_id = v_org AND (b.is_default OR b.slug = 'principal')
    ), '[]'::jsonb),
    'company_info', (SELECT pg_catalog.to_jsonb(ws) FROM public.website_settings AS ws
      WHERE ws.organization_id = v_org AND ws.key = 'company_info')
  ) INTO v_before_state;
  BEGIN
    PERFORM public.complete_organization_onboarding_v2(
      v_org, v_user, 5, 'Synthetic Shop', 'PYG', 'America/Asuncion', 'PY', 'es-PY', '',
      '{"name":"Principal","city":"Asuncion","address":"Synthetic address","phone":""}'::jsonb,
      '{"name":"Synthetic Shop","hours":{"weekdays":"08:00-17:00"}}'::jsonb,
      '{"companyPhone":"new"}'::jsonb,
      '{"business_vertical":"general","operating_model":"retail","enabled_modules":["inventory"],"service_specialties":[]}'::jsonb,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_failure_message = MESSAGE_TEXT;
    IF v_failure_message = 'SYNTHETIC_COMPLETION_FAILURE' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  SELECT pg_catalog.jsonb_build_object(
    'organization', (SELECT pg_catalog.to_jsonb(o) FROM public.organizations AS o WHERE o.id = v_org),
    'organization_settings', (SELECT pg_catalog.to_jsonb(s) FROM public.organization_settings AS s WHERE s.organization_id = v_org),
    'primary_branches', coalesce((
      SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) ORDER BY b.is_default DESC, b.created_at ASC)
      FROM public.branches AS b
      WHERE b.organization_id = v_org AND (b.is_default OR b.slug = 'principal')
    ), '[]'::jsonb),
    'company_info', (SELECT pg_catalog.to_jsonb(ws) FROM public.website_settings AS ws
      WHERE ws.organization_id = v_org AND ws.key = 'company_info')
  ) INTO v_after_state;
  IF NOT v_failed OR v_after_state IS DISTINCT FROM v_before_state THEN
    RAISE EXCEPTION 'COMPLETION_FAILURE_LEFT_PARTIAL_WRITES';
  END IF;

  IF has_function_privilege('anon', 'public.save_organization_onboarding_progress_v2(uuid,uuid,bigint,integer,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.save_organization_onboarding_progress_v2(uuid,uuid,bigint,integer,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.save_organization_onboarding_progress_v2(uuid,uuid,bigint,integer,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROGRESS_RPC_ACL_MISMATCH';
  END IF;
  IF has_function_privilege('anon', 'public.complete_organization_onboarding_v2(uuid,uuid,bigint,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_organization_onboarding_v2(uuid,uuid,bigint,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.complete_organization_onboarding_v2(uuid,uuid,bigint,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.merge_organization_admin_settings_v2(uuid,uuid,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.merge_organization_admin_settings_v2(uuid,uuid,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.merge_organization_admin_settings_v2(uuid,uuid,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'V2_RPC_ACL_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_proc AS proc
      WHERE proc.oid IN (
        'public.save_organization_onboarding_progress_v2(uuid,uuid,bigint,integer,jsonb)'::regprocedure,
        'public.complete_organization_onboarding_v2(uuid,uuid,bigint,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean)'::regprocedure,
        'public.merge_organization_admin_settings_v2(uuid,uuid,jsonb,jsonb)'::regprocedure
      ) AND proc.prosecdef AND proc.proconfig @> ARRAY['search_path=""']) <> 3 THEN
    RAISE EXCEPTION 'V2_RPC_SECURITY_CONTRACT_MISMATCH';
  END IF;
  IF to_regprocedure('public.complete_organization_onboarding(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb)') IS NULL
     OR NOT (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
             FROM pg_proc WHERE oid = 'public.complete_organization_onboarding(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure)
     OR has_function_privilege('anon', 'public.complete_organization_onboarding(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_organization_onboarding(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.complete_organization_onboarding(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'LEGACY_RPC_COMPATIBILITY_OR_ACL_MISMATCH';
  END IF;

  -- The unchanged legacy signature remains callable and does not invent regional values.
  INSERT INTO public.organizations (id, name, slug, owner_id)
  VALUES (v_legacy_org, 'Synthetic Legacy', 'legacy-' || left(v_legacy_org::text, 24), v_user);
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_legacy_org, v_user, 'owner', 'active');
  INSERT INTO public.organization_settings (organization_id, display_name, currency, timezone, modules)
  VALUES (v_legacy_org, 'Synthetic Legacy', 'PYG', 'America/Asuncion',
          '{"onboarding":{"status":"completed","completed_at":"preserve-legacy"}}'::jsonb);
  v_result := public.complete_organization_onboarding(
    v_legacy_org, v_user, 'Synthetic Legacy Updated', 'PYG', 'America/Asuncion', '',
    '{"onboarding":{"status":"completed","completed_at":"preserve-legacy"}}'::jsonb,
    '{"name":"Legacy Primary","city":"Asuncion","address":"Synthetic address"}'::jsonb,
    '{"name":"Synthetic Legacy Updated"}'::jsonb
  );
  IF v_result->>'organization_id' <> v_legacy_org::text
     OR (SELECT country_code FROM public.organization_settings WHERE organization_id = v_legacy_org) IS NOT NULL
     OR (SELECT locale FROM public.organization_settings WHERE organization_id = v_legacy_org) IS NOT NULL
     OR (SELECT modules->'onboarding'->>'status' FROM public.organization_settings WHERE organization_id = v_legacy_org) <> 'completed'
     OR (SELECT count(*) FROM public.branches WHERE organization_id = v_legacy_org AND is_default) <> 1 THEN
    RAISE EXCEPTION 'LEGACY_COMPATIBILITY_REGRESSION';
  END IF;
END;
$$;
ROLLBACK;
