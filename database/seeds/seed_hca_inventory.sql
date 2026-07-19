-- ============================================================================
-- Seed: Inventario de repuestos para hca.celulares@gmail.com
-- Crea categorías de repuestos, productos/stock y servicios de mano de obra
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_cat_pantallas UUID;
  v_cat_baterias UUID;
  v_cat_conectores UUID;
  v_cat_herramientas UUID;
  v_cat_servicios UUID;
BEGIN
  -- Resolver usuario y organización
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hca.celulares@gmail.com' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;

  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id AND om.status = 'active'
  ORDER BY om.created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Organización no encontrada'; END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORÍAS
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.categories (id, organization_id, name, created_at)
  VALUES
    (gen_random_uuid(), v_org_id, 'Pantallas', now()),
    (gen_random_uuid(), v_org_id, 'Baterías', now()),
    (gen_random_uuid(), v_org_id, 'Conectores y Flex', now()),
    (gen_random_uuid(), v_org_id, 'Herramientas', now()),
    (gen_random_uuid(), v_org_id, 'Servicios', now())
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_pantallas FROM public.categories WHERE organization_id = v_org_id AND name = 'Pantallas' LIMIT 1;
  SELECT id INTO v_cat_baterias FROM public.categories WHERE organization_id = v_org_id AND name = 'Baterías' LIMIT 1;
  SELECT id INTO v_cat_conectores FROM public.categories WHERE organization_id = v_org_id AND name = 'Conectores y Flex' LIMIT 1;
  SELECT id INTO v_cat_herramientas FROM public.categories WHERE organization_id = v_org_id AND name = 'Herramientas' LIMIT 1;
  SELECT id INTO v_cat_servicios FROM public.categories WHERE organization_id = v_org_id AND name = 'Servicios' LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- REPUESTOS (productos físicos con stock)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.products (id, organization_id, name, sku, category_id, brand,
    purchase_price, sale_price, stock_quantity, min_stock, unit_measure, is_active, visibility, created_at, updated_at)
  VALUES
    -- Pantallas
    (gen_random_uuid(), v_org_id, 'Display OLED iPhone 12/12 Pro Original', 'PAN-IP12-ORI', v_cat_pantallas, 'Apple',
     120000, 180000, 3, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Display OLED iPhone 13 Original', 'PAN-IP13-ORI', v_cat_pantallas, 'Apple',
     145000, 220000, 2, 1, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Display LCD Samsung A54 Compatible', 'PAN-SA54-COM', v_cat_pantallas, 'Samsung',
     65000, 95000, 5, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Display AMOLED Samsung S23 Ultra Original', 'PAN-SS23U-ORI', v_cat_pantallas, 'Samsung',
     250000, 380000, 1, 1, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Display LCD Xiaomi Redmi Note 12', 'PAN-XRN12-COM', v_cat_pantallas, 'Xiaomi',
     40000, 65000, 4, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Display LCD Motorola Moto G53', 'PAN-MG53-COM', v_cat_pantallas, 'Motorola',
     35000, 55000, 3, 2, 'unidad', true, 'hidden', now(), now()),

    -- Baterías
    (gen_random_uuid(), v_org_id, 'Batería iPhone 12 Original', 'BAT-IP12-ORI', v_cat_baterias, 'Apple',
     25000, 45000, 6, 3, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Batería iPhone 13 Original', 'BAT-IP13-ORI', v_cat_baterias, 'Apple',
     30000, 50000, 4, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Batería Samsung A54 EB-BA546ABY', 'BAT-SA54-ORI', v_cat_baterias, 'Samsung',
     20000, 35000, 5, 3, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Batería Xiaomi BN5G Redmi Note 12', 'BAT-XRN12', v_cat_baterias, 'Xiaomi',
     15000, 28000, 8, 3, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Batería Motorola Moto G53 NG50', 'BAT-MG53', v_cat_baterias, 'Motorola',
     18000, 30000, 3, 2, 'unidad', true, 'hidden', now(), now()),

    -- Conectores y Flex
    (gen_random_uuid(), v_org_id, 'Pin de carga USB-C Samsung A54', 'CON-SA54-USBC', v_cat_conectores, 'Samsung',
     8000, 15000, 10, 5, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Pin de carga Lightning iPhone 12', 'CON-IP12-LTN', v_cat_conectores, 'Apple',
     12000, 22000, 6, 3, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Flex encendido iPhone 13', 'FLX-IP13-PWR', v_cat_conectores, 'Apple',
     15000, 25000, 4, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Pin de carga USB-C Xiaomi Redmi Note 12', 'CON-XRN12-USBC', v_cat_conectores, 'Xiaomi',
     5000, 10000, 12, 5, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Flex volumen + power Motorola G53', 'FLX-MG53-VOL', v_cat_conectores, 'Motorola',
     7000, 12000, 5, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Módulo cámara trasera Samsung S23 Ultra', 'CAM-SS23U-TRA', v_cat_conectores, 'Samsung',
     200000, 320000, 1, 1, 'unidad', true, 'hidden', now(), now()),

    -- Herramientas / Consumibles
    (gen_random_uuid(), v_org_id, 'Adhesivo B-7000 50ml', 'HER-B7000-50', v_cat_herramientas, 'Genérico',
     3000, 5000, 15, 5, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Cinta adhesiva doble cara 3M 2mm', 'HER-3M-2MM', v_cat_herramientas, '3M',
     5000, 8000, 8, 3, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Tornillos pentalobe iPhone (set x50)', 'HER-TORN-PENT', v_cat_herramientas, 'Genérico',
     4000, 7000, 6, 2, 'unidad', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Pasta térmica Arctic MX-4 4g', 'HER-PASTA-MX4', v_cat_herramientas, 'Arctic',
     12000, 20000, 4, 2, 'unidad', true, 'hidden', now(), now())

  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SERVICIOS (mano de obra, sin stock físico)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.products (id, organization_id, name, sku, category_id,
    purchase_price, sale_price, stock_quantity, min_stock, unit_measure, is_active, visibility, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_org_id, 'Cambio de pantalla', 'SRV-PANTALLA', v_cat_servicios,
     0, 40000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Cambio de batería', 'SRV-BATERIA', v_cat_servicios,
     0, 25000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Cambio de pin de carga', 'SRV-PINCARGA', v_cat_servicios,
     0, 20000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Limpieza ultrasónica (daño por líquido)', 'SRV-ULTRASON', v_cat_servicios,
     0, 35000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Diagnóstico avanzado con osciloscopio', 'SRV-DIAG-OSC', v_cat_servicios,
     0, 30000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Reballing / Microsoldadura', 'SRV-REBALLING', v_cat_servicios,
     0, 80000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Formateo y reinstalación de software', 'SRV-FORMAT', v_cat_servicios,
     0, 15000, 9999, 0, 'servicio', true, 'hidden', now(), now()),
    (gen_random_uuid(), v_org_id, 'Recuperación de datos', 'SRV-RECUP-DATOS', v_cat_servicios,
     0, 50000, 9999, 0, 'servicio', true, 'hidden', now(), now())

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed completado: categorías, 20 repuestos y 8 servicios creados para hca.celulares@gmail.com';
END;
$$;
