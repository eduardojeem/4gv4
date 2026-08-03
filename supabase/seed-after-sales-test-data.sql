-- ============================================================================
-- Datos de prueba para Posventa (garantias, cambios y devoluciones)
-- ============================================================================
--
-- Crea escenarios listos para probar el circuito completo:
--
--   REP-A  Reparacion entregada con garantia VIGENTE  -> reclamar y aprobar
--   REP-B  Reparacion entregada con garantia VENCIDA  -> probar la advertencia
--   VTA-A  Venta con 2 productos                      -> devolucion / cambio
--
-- Se ejecuta sobre UNA organizacion. Por defecto toma la primera; para elegir
-- otra, cambia el valor de v_org_name abajo.
--
-- Es idempotente: volver a correrlo no duplica nada, porque todo lo que crea
-- lleva la marca [PRUEBA POSVENTA] y se busca antes de insertar.
--
-- Para BORRAR todo lo que crea este script, corre al final:
--   supabase/seed-after-sales-test-data.sql  (seccion LIMPIEZA, comentada)
--
-- NO va en migrations/ a proposito: son datos de prueba, no de esquema.
-- ============================================================================

DO $$
DECLARE
  -- Deja NULL para usar la primera organizacion, o pone el nombre exacto.
  v_org_name    TEXT := NULL;

  v_org_id      UUID;
  v_branch_id   UUID;
  v_customer_id UUID;
  v_repair_ok   UUID;
  v_repair_old  UUID;
  v_sale_id     UUID;
  v_product_a   UUID;
  v_product_b   UUID;
  v_price_a     NUMERIC;
  v_price_b     NUMERIC;
  v_total       NUMERIC;
  v_marker      TEXT := '[PRUEBA POSVENTA]';
  v_sale_code   TEXT;
BEGIN
  -- ── Organizacion y sucursal ───────────────────────────────────────────────
  IF v_org_name IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  ELSE
    SELECT id INTO v_org_id FROM public.organizations WHERE name = v_org_name LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro ninguna organizacion. Revisa v_org_name.';
  END IF;

  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE organization_id = v_org_id
  ORDER BY created_at
  LIMIT 1;

  RAISE NOTICE 'Organizacion: % / Sucursal: %', v_org_id, COALESCE(v_branch_id::TEXT, 'sin sucursal');

  -- ── Cliente de prueba ─────────────────────────────────────────────────────
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE organization_id = v_org_id AND name = v_marker || ' Juan Perez'
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (organization_id, name, email, phone)
    VALUES (v_org_id, v_marker || ' Juan Perez', 'prueba.posventa@example.com', '0981000000')
    RETURNING id INTO v_customer_id;
    RAISE NOTICE 'Cliente creado: %', v_customer_id;
  ELSE
    RAISE NOTICE 'Cliente ya existia: %', v_customer_id;
  END IF;

  -- ── REP-A: garantia VIGENTE (entregada hace 10 dias, 6 meses de garantia) ──
  SELECT id INTO v_repair_ok
  FROM public.repairs
  WHERE organization_id = v_org_id AND problem_description LIKE v_marker || ' VIGENTE%'
  LIMIT 1;

  IF v_repair_ok IS NULL THEN
    INSERT INTO public.repairs (
      organization_id, branch_id, customer_id,
      device_type, device_brand, device_model, problem_description,
      status, estimated_cost, labor_cost,
      warranty_months, warranty_type,
      completed_at, delivered_at, warranty_expires_at
    ) VALUES (
      v_org_id, v_branch_id, v_customer_id,
      'smartphone', 'Samsung', 'Galaxy A54',
      v_marker || ' VIGENTE - Cambio de pantalla',
      'entregado', 350000, 150000,
      6, 'full',
      NOW() - INTERVAL '11 days',
      NOW() - INTERVAL '10 days',
      -- La garantia corre desde la entrega, igual que la calcula la app.
      (NOW() - INTERVAL '10 days') + INTERVAL '6 months'
    )
    RETURNING id INTO v_repair_ok;
    RAISE NOTICE 'REP-A (garantia vigente) creada: %', v_repair_ok;
  END IF;

  -- ── REP-B: garantia VENCIDA (entregada hace 8 meses, 3 meses de garantia) ──
  SELECT id INTO v_repair_old
  FROM public.repairs
  WHERE organization_id = v_org_id AND problem_description LIKE v_marker || ' VENCIDA%'
  LIMIT 1;

  IF v_repair_old IS NULL THEN
    INSERT INTO public.repairs (
      organization_id, branch_id, customer_id,
      device_type, device_brand, device_model, problem_description,
      status, estimated_cost, labor_cost,
      warranty_months, warranty_type,
      completed_at, delivered_at, warranty_expires_at
    ) VALUES (
      v_org_id, v_branch_id, v_customer_id,
      'laptop', 'Lenovo', 'IdeaPad 3',
      v_marker || ' VENCIDA - Cambio de teclado',
      'entregado', 280000, 120000,
      3, 'labor',
      NOW() - INTERVAL '8 months' - INTERVAL '1 day',
      NOW() - INTERVAL '8 months',
      (NOW() - INTERVAL '8 months') + INTERVAL '3 months'
    )
    RETURNING id INTO v_repair_old;
    RAISE NOTICE 'REP-B (garantia vencida) creada: %', v_repair_old;
  END IF;

  -- ── VTA-A: venta con 2 productos, para devolucion y cambio ────────────────
  SELECT id, COALESCE(sale_price, 0) INTO v_product_a, v_price_a
  FROM public.products
  WHERE organization_id = v_org_id
  ORDER BY created_at
  LIMIT 1;

  SELECT id, COALESCE(sale_price, 0) INTO v_product_b, v_price_b
  FROM public.products
  WHERE organization_id = v_org_id AND id <> COALESCE(v_product_a, '00000000-0000-0000-0000-000000000000'::UUID)
  ORDER BY created_at
  LIMIT 1;

  IF v_product_a IS NULL THEN
    RAISE NOTICE 'Sin productos en la organizacion: se omite la venta de prueba.';
  ELSIF v_branch_id IS NULL THEN
    -- `sales.branch_id` tambien es NOT NULL.
    RAISE NOTICE 'La organizacion no tiene sucursales: se omite la venta de prueba.';
  ELSE
    SELECT id INTO v_sale_id
    FROM public.sales
    WHERE organization_id = v_org_id AND notes = v_marker
    LIMIT 1;

    IF v_sale_id IS NULL THEN
      v_total := COALESCE(v_price_a, 0) * 2 + COALESCE(v_price_b, 0);

      -- `sales.code` es NOT NULL y no tiene default, asi que hay que darselo.
      v_sale_code := 'VTA-PRB-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8));

      INSERT INTO public.sales (
        organization_id, branch_id, customer_id, code,
        payment_method, discount_amount, tax_amount,
        total_amount, subtotal_amount, notes
      ) VALUES (
        v_org_id, v_branch_id, v_customer_id, v_sale_code,
        'cash', 0, 0,
        v_total, v_total, v_marker
      )
      RETURNING id INTO v_sale_id;

      INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal, discount)
      VALUES (v_sale_id, v_product_a, 2, v_price_a, COALESCE(v_price_a, 0) * 2, 0);

      IF v_product_b IS NOT NULL THEN
        INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal, discount)
        VALUES (v_sale_id, v_product_b, 1, v_price_b, COALESCE(v_price_b, 0), 0);
      END IF;

      RAISE NOTICE 'VTA-A creada: % (total %)', v_sale_id, v_total;
    ELSE
      RAISE NOTICE 'VTA-A ya existia: %', v_sale_id;
    END IF;
  END IF;

  -- ── Saldo a favor, para probar el canje en el POS ─────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_store_credits
    WHERE organization_id = v_org_id AND customer_id = v_customer_id AND reason LIKE v_marker || '%'
  ) THEN
    INSERT INTO public.customer_store_credits (organization_id, customer_id, amount, reason, source_type)
    VALUES (v_org_id, v_customer_id, 150000, v_marker || ' Saldo inicial de prueba', 'manual');
    RAISE NOTICE 'Saldo a favor de 150.000 acreditado al cliente de prueba.';
  END IF;

  RAISE NOTICE '--- Listo. Busca "%" en Reparaciones, Ventas y Clientes. ---', v_marker;
END $$;

-- ============================================================================
-- LIMPIEZA (descomenta y ejecuta para borrar TODO lo que crea este script)
-- ============================================================================
-- DO $$
-- DECLARE
--   v_marker TEXT := '[PRUEBA POSVENTA]';
--   v_customer_id UUID;
-- BEGIN
--   SELECT id INTO v_customer_id FROM public.customers WHERE name = v_marker || ' Juan Perez' LIMIT 1;
--   IF v_customer_id IS NULL THEN RETURN; END IF;
--
--   DELETE FROM public.after_sales_cases WHERE customer_id = v_customer_id;
--   DELETE FROM public.customer_store_credits WHERE customer_id = v_customer_id;
--   DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE customer_id = v_customer_id);
--   DELETE FROM public.sales WHERE customer_id = v_customer_id;
--   DELETE FROM public.repair_notes WHERE repair_id IN (SELECT id FROM public.repairs WHERE customer_id = v_customer_id);
--   DELETE FROM public.repairs WHERE customer_id = v_customer_id;
--   DELETE FROM public.customers WHERE id = v_customer_id;
--   RAISE NOTICE 'Datos de prueba eliminados.';
-- END $$;
