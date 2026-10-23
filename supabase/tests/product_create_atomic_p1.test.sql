-- Run only against the isolated Supabase Local DEV database. Every fixture rolls back.
BEGIN;
DO $$
DECLARE
  actor uuid := gen_random_uuid();
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  branch_a uuid := gen_random_uuid();
  category_a uuid := gen_random_uuid();
  category_b uuid := gen_random_uuid();
  supplier_a uuid := gen_random_uuid();
  supplier_b uuid := gen_random_uuid();
  created_id uuid;
  variant_product_id uuid;
  variant_null_id uuid;
  variant_zero_id uuid;
  message text;
BEGIN
  INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (actor, 'product-integrity-' || actor::text || '@example.invalid', now(), now(), '{}'::jsonb, '{}'::jsonb);
  INSERT INTO public.organizations (id, name, slug, owner_id)
  VALUES (org_a, 'Synthetic Product Test A', 'synthetic-product-' || org_a::text, actor),
         (org_b, 'Synthetic Product Test B', 'synthetic-product-' || org_b::text, null);
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (org_a, actor, 'owner', 'active');
  INSERT INTO public.branches (id, organization_id, code, name, slug, is_default)
  VALUES (branch_a, org_a, 'TEST-' || left(actor::text, 8), 'Synthetic Branch', 'synthetic-' || left(actor::text, 8), true);
  INSERT INTO public.categories (id, organization_id, name) VALUES
    (category_a, org_a, 'Synthetic category A'), (category_b, org_b, 'Synthetic category B');
  INSERT INTO public.suppliers (id, organization_id, name) VALUES
    (supplier_a, org_a, 'Synthetic supplier A'), (supplier_b, org_b, 'Synthetic supplier B');

  -- A new simple product writes product, branch stock, one initial movement and its batch atomically.
  created_id := (public.create_simple_product_atomic(jsonb_build_object(
    'organization_id', org_a, 'name', 'Synthetic Product Atomic', 'sku', 'SYNTH-ATOMIC-' || left(actor::text, 8),
    'category_id', category_a, 'supplier_id', supplier_a, 'stock_quantity', 10, 'sale_price', 100,
    'initial_batch', jsonb_build_object('lot_code', 'SYNTH-LOT', 'expires_on', '2030-12-31')
  ), branch_a, actor)->>'product_id')::uuid;
  IF (SELECT stock_quantity FROM public.products WHERE id = created_id) IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'PRODUCT_TOTAL_STOCK_MISMATCH'; END IF;
  IF (SELECT stock_quantity FROM public.branch_inventory WHERE product_id = created_id AND branch_id = branch_a) IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'BRANCH_STOCK_MISMATCH'; END IF;
  IF (SELECT count(*) FROM public.product_movements WHERE product_id = created_id AND movement_type = 'initial' AND quantity = 10 AND previous_stock = 0 AND new_stock = 10 AND user_id = actor) <> 1 THEN RAISE EXCEPTION 'INITIAL_MOVEMENT_MISMATCH'; END IF;
  IF (SELECT count(*) FROM public.product_batches WHERE product_id = created_id AND quantity = 10) <> 1 THEN RAISE EXCEPTION 'INITIAL_BATCH_MISMATCH'; END IF;
  IF (SELECT purchase_price IS NOT NULL FROM public.products WHERE id = created_id) THEN RAISE EXCEPTION 'UNKNOWN_COST_NOT_NULL'; END IF;

  -- Explicit zero remains a real zero. SKU normalization is canonical.
  PERFORM public.create_simple_product_atomic(jsonb_build_object(
    'organization_id', org_a, 'name', 'Synthetic Zero Cost', 'sku', ' test-zero-' || left(actor::text, 8) || ' ',
    'purchase_price', 0, 'sale_price', 100, 'stock_quantity', 0
  ), branch_a, actor);
  IF (SELECT purchase_price IS DISTINCT FROM 0 OR sku IS DISTINCT FROM upper(trim(sku)) FROM public.products WHERE organization_id = org_a AND sku = 'TEST-ZERO-' || upper(left(actor::text, 8))) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'EXPLICIT_ZERO_OR_SKU_NORMALIZATION_MISMATCH';
  END IF;
  BEGIN
    PERFORM public.create_simple_product_atomic(jsonb_build_object(
      'organization_id', org_a, 'name', 'Synthetic Duplicate SKU', 'sku', lower('TEST-ZERO-' || left(actor::text, 8)),
      'sale_price', 100, 'stock_quantity', 0
    ), branch_a, actor);
    RAISE EXCEPTION 'CASE_INSENSITIVE_SKU_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Foreign category/supplier identifiers are rejected by the DB boundary.
  FOREACH message IN ARRAY ARRAY['category_id', 'supplier_id'] LOOP
    BEGIN
      PERFORM public.create_simple_product_atomic(jsonb_build_object(
        'organization_id', org_a, 'name', 'Rejected Foreign Reference',
        'sku', 'SYNTH-FOREIGN-' || message || '-' || left(actor::text, 8), 'sale_price', 100,
        message, CASE WHEN message = 'category_id' THEN category_b::text ELSE supplier_b::text END
      ), branch_a, actor);
      RAISE EXCEPTION 'FOREIGN_REFERENCE_ACCEPTED_%', message;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'FOREIGN_REFERENCE_ACCEPTED_%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%PRODUCT_REFERENCE_FORBIDDEN%' THEN RAISE; END IF;
    END;
  END LOOP;

  -- A later batch failure rolls back the product, branch stock and movement.
  BEGIN
    PERFORM public.create_simple_product_atomic(jsonb_build_object(
      'organization_id', org_a, 'name', 'Synthetic Rollback', 'sku', 'SYNTH-ROLLBACK-' || left(actor::text, 8),
      'sale_price', 100, 'stock_quantity', 4,
      'initial_batch', jsonb_build_object('expires_on', 'not-a-date')
    ), branch_a, actor);
    RAISE EXCEPTION 'EXPECTED_BATCH_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_BATCH_FAILURE_NOT_RAISED' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.products WHERE sku = 'SYNTH-ROLLBACK-' || left(actor::text, 8)) THEN RAISE EXCEPTION 'PARTIAL_PRODUCT_AFTER_FAILURE'; END IF;

  -- No branch can receive positive stock implicitly.
  BEGIN
    PERFORM public.create_simple_product_atomic(jsonb_build_object(
      'organization_id', org_a, 'name', 'Synthetic No Branch', 'sku', 'SYNTH-NOBRANCH-' || left(actor::text, 8),
      'sale_price', 100, 'stock_quantity', 5
    ), null, actor);
    RAISE EXCEPTION 'BRANCHLESS_STOCK_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'BRANCHLESS_STOCK_ACCEPTED' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%PRODUCT_BRANCH_REQUIRED%' THEN RAISE; END IF;
  END;

  -- Variant parent/child costs preserve NULL and explicit zero independently.
  variant_product_id := (public.save_product_with_variants(
    jsonb_build_object('organization_id', org_a, 'name', 'Synthetic Variants', 'sku', 'SYNTH-VARIANTS-' || left(actor::text, 8),
      'sale_price', 100, 'purchase_price', null, 'has_variants', true,
      'variant_attribute_config', jsonb_build_array(jsonb_build_object('key','color','label','Color','control','select','options',jsonb_build_array('Blue')))),
    jsonb_build_array(
      jsonb_build_object('name','Unknown','sku','SYNTH-VAR-NULL-' || left(actor::text, 8),'attributes',jsonb_build_object('color','Blue'),'sale_price',100,'purchase_price',null,'stock_quantity',0),
      jsonb_build_object('name','Zero','sku','SYNTH-VAR-ZERO-' || left(actor::text, 8),'attributes',jsonb_build_object('color','Black'),'sale_price',100,'purchase_price',0,'stock_quantity',0)
    ), branch_a, actor)->>'product_id')::uuid;
  SELECT id INTO variant_null_id FROM public.product_variants WHERE product_id = variant_product_id AND sku LIKE 'SYNTH-VAR-NULL-%';
  SELECT id INTO variant_zero_id FROM public.product_variants WHERE product_id = variant_product_id AND sku LIKE 'SYNTH-VAR-ZERO-%';
  IF (SELECT purchase_price IS NOT NULL FROM public.products WHERE id = variant_product_id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'VARIANT_PARENT_UNKNOWN_COST_NOT_NULL'; END IF;
  IF (SELECT purchase_price IS NOT NULL FROM public.product_variants WHERE id = variant_null_id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'VARIANT_UNKNOWN_COST_NOT_NULL'; END IF;
  IF (SELECT purchase_price IS DISTINCT FROM 0 FROM public.product_variants WHERE id = variant_zero_id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'VARIANT_EXPLICIT_ZERO_CHANGED'; END IF;
END;
$$;
ROLLBACK;
