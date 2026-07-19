-- ============================================================================
-- Seed: Productos públicos, marcas y categorías para hca.celulares@gmail.com
-- Productos con imágenes de ejemplo (placeholders públicos)
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_cat_fundas UUID;
  v_cat_cargadores UUID;
  v_cat_auriculares UUID;
  v_cat_protectores UUID;
  v_cat_cables UUID;
  v_brand_apple UUID;
  v_brand_samsung UUID;
  v_brand_xiaomi UUID;
  v_brand_anker UUID;
  v_brand_jbl UUID;
  v_brand_baseus UUID;
  v_brand_ugreen UUID;
  v_brand_spigen UUID;
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
  -- MARCAS
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Insertar marcas solo si no existen para esta org
  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Apple', 'Tecnología premium de California', 'Estados Unidos', 'https://ui-avatars.com/api/?name=Apple&background=000000&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Apple' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Samsung', 'Electrónica y celulares de Corea del Sur', 'Corea del Sur', 'https://ui-avatars.com/api/?name=Samsung&background=1428A0&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Samsung' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Xiaomi', 'Tecnología accesible de alta calidad', 'China', 'https://ui-avatars.com/api/?name=Xiaomi&background=FF6900&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Xiaomi' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Anker', 'Accesorios de carga y energía', 'China', 'https://ui-avatars.com/api/?name=Anker&background=00B4D8&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Anker' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'JBL', 'Audio profesional y consumer', 'Estados Unidos', 'https://ui-avatars.com/api/?name=JBL&background=FF3B30&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'JBL' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Baseus', 'Accesorios tecnológicos innovadores', 'China', 'https://ui-avatars.com/api/?name=Baseus&background=333333&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Baseus' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Ugreen', 'Cables y conectividad premium', 'China', 'https://ui-avatars.com/api/?name=Ugreen&background=2E7D32&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Ugreen' AND organization_id = v_org_id);

  INSERT INTO public.brands (id, name, description, country, logo_url, is_active, organization_id)
  SELECT gen_random_uuid(), 'Spigen', 'Fundas y protección para celulares', 'Corea del Sur', 'https://ui-avatars.com/api/?name=Spigen&background=424242&color=fff&size=128', true, v_org_id
  WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Spigen' AND organization_id = v_org_id);

  SELECT id INTO v_brand_apple FROM public.brands WHERE name = 'Apple' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_samsung FROM public.brands WHERE name = 'Samsung' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_xiaomi FROM public.brands WHERE name = 'Xiaomi' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_anker FROM public.brands WHERE name = 'Anker' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_jbl FROM public.brands WHERE name = 'JBL' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_baseus FROM public.brands WHERE name = 'Baseus' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_ugreen FROM public.brands WHERE name = 'Ugreen' AND organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_brand_spigen FROM public.brands WHERE name = 'Spigen' AND organization_id = v_org_id LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORÍAS DE VENTA
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.categories (id, organization_id, name, created_at)
  VALUES
    (gen_random_uuid(), v_org_id, 'Fundas y Cases', now()),
    (gen_random_uuid(), v_org_id, 'Cargadores', now()),
    (gen_random_uuid(), v_org_id, 'Auriculares', now()),
    (gen_random_uuid(), v_org_id, 'Protectores de Pantalla', now()),
    (gen_random_uuid(), v_org_id, 'Cables', now())
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_fundas FROM public.categories WHERE organization_id = v_org_id AND name = 'Fundas y Cases' LIMIT 1;
  SELECT id INTO v_cat_cargadores FROM public.categories WHERE organization_id = v_org_id AND name = 'Cargadores' LIMIT 1;
  SELECT id INTO v_cat_auriculares FROM public.categories WHERE organization_id = v_org_id AND name = 'Auriculares' LIMIT 1;
  SELECT id INTO v_cat_protectores FROM public.categories WHERE organization_id = v_org_id AND name = 'Protectores de Pantalla' LIMIT 1;
  SELECT id INTO v_cat_cables FROM public.categories WHERE organization_id = v_org_id AND name = 'Cables' LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PRODUCTOS PÚBLICOS (con imágenes placeholder)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.products (id, organization_id, name, sku, category_id, brand, brand_id,
    description, purchase_price, sale_price, stock_quantity, min_stock, 
    unit_measure, is_active, visibility, image_url, featured, created_at, updated_at)
  VALUES
    -- FUNDAS
    (gen_random_uuid(), v_org_id, 'Funda Spigen Ultra Hybrid iPhone 15', 'FUN-SP-IP15', v_cat_fundas, 'Spigen', v_brand_spigen,
     'Funda transparente con bordes reforzados. Protección militar contra caídas. Compatible con carga inalámbrica.',
     35000, 65000, 12, 5, 'unidad', true, 'public',
     'https://picsum.photos/seed/funda1/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'Funda Spigen Tough Armor Samsung S24', 'FUN-SP-SS24', v_cat_fundas, 'Spigen', v_brand_spigen,
     'Protección máxima con kickstand integrado. Doble capa de absorción de impactos.',
     40000, 75000, 8, 3, 'unidad', true, 'public',
     'https://picsum.photos/seed/funda2/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Funda Silicona Apple MagSafe iPhone 15 Pro', 'FUN-AP-IP15P', v_cat_fundas, 'Apple', v_brand_apple,
     'Funda de silicona original Apple con imanes MagSafe. Tacto suave y agarre perfecto.',
     80000, 150000, 5, 2, 'unidad', true, 'public',
     'https://picsum.photos/seed/funda3/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'Funda Xiaomi Redmi Note 13 Flip Cover', 'FUN-XI-RN13', v_cat_fundas, 'Xiaomi', v_brand_xiaomi,
     'Funda tipo libro con ranura para tarjetas. Cuero sintético premium.',
     20000, 38000, 15, 5, 'unidad', true, 'public',
     'https://picsum.photos/seed/funda4/400/400', false, now(), now()),

    -- CARGADORES
    (gen_random_uuid(), v_org_id, 'Cargador Anker Nano 20W USB-C', 'CRG-AN-20W', v_cat_cargadores, 'Anker', v_brand_anker,
     'Cargador ultra compacto 20W con Power Delivery. Carga rápida para iPhone y Samsung. Certificado de seguridad.',
     18000, 35000, 20, 8, 'unidad', true, 'public',
     'https://picsum.photos/seed/cargador1/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'Cargador Anker 65W GaN USB-C Dual', 'CRG-AN-65W', v_cat_cargadores, 'Anker', v_brand_anker,
     'Cargador GaN de 65W con 2 puertos USB-C. Ideal para celular + laptop simultáneo.',
     45000, 85000, 6, 3, 'unidad', true, 'public',
     'https://picsum.photos/seed/cargador2/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'Cargador Inalámbrico Baseus 15W MagSafe', 'CRG-BS-MAG15', v_cat_cargadores, 'Baseus', v_brand_baseus,
     'Cargador inalámbrico magnético compatible con MagSafe. 15W de carga rápida.',
     25000, 48000, 10, 4, 'unidad', true, 'public',
     'https://picsum.photos/seed/cargador3/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Cargador Auto Baseus 30W USB-C + USB-A', 'CRG-BS-AUTO30', v_cat_cargadores, 'Baseus', v_brand_baseus,
     'Cargador de auto dual con Power Delivery 30W. Carga completa en el viaje.',
     15000, 28000, 14, 5, 'unidad', true, 'public',
     'https://picsum.photos/seed/cargador4/400/400', false, now(), now()),

    -- AURICULARES
    (gen_random_uuid(), v_org_id, 'JBL Tune 520BT Auriculares Bluetooth', 'AUR-JBL-T520', v_cat_auriculares, 'JBL', v_brand_jbl,
     'Auriculares over-ear con 57h de batería. Bluetooth 5.3, plegables, micrófono integrado.',
     55000, 95000, 7, 3, 'unidad', true, 'public',
     'https://picsum.photos/seed/auricular1/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'JBL Wave Beam TWS Earbuds', 'AUR-JBL-WBEAM', v_cat_auriculares, 'JBL', v_brand_jbl,
     'Auriculares in-ear true wireless con cancelación de ruido. IP54 resistentes al agua.',
     40000, 72000, 9, 4, 'unidad', true, 'public',
     'https://picsum.photos/seed/auricular2/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Xiaomi Buds 4 Pro ANC', 'AUR-XI-B4PRO', v_cat_auriculares, 'Xiaomi', v_brand_xiaomi,
     'Cancelación activa de ruido 48dB. Hi-Res Audio, 9h de autonomía, carga inalámbrica.',
     60000, 110000, 4, 2, 'unidad', true, 'public',
     'https://picsum.photos/seed/auricular3/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'Samsung Galaxy Buds FE', 'AUR-SS-BUDSFE', v_cat_auriculares, 'Samsung', v_brand_samsung,
     'ANC activo, sonido AKG, hasta 30h con estuche. Resistencia IPX2.',
     50000, 89000, 6, 3, 'unidad', true, 'public',
     'https://picsum.photos/seed/auricular4/400/400', false, now(), now()),

    -- PROTECTORES DE PANTALLA
    (gen_random_uuid(), v_org_id, 'Vidrio Templado iPhone 15 Pro Max (Pack x3)', 'VID-IP15PM-3', v_cat_protectores, 'Spigen', v_brand_spigen,
     'Pack de 3 vidrios templados 9H. Cobertura completa, oleofóbico, incluye kit de instalación.',
     12000, 25000, 25, 10, 'unidad', true, 'public',
     'https://picsum.photos/seed/vidrio1/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Vidrio Templado Samsung S24 Ultra UV', 'VID-SS24U-UV', v_cat_protectores, 'Baseus', v_brand_baseus,
     'Vidrio con adhesivo UV para pantallas curvas. Máxima transparencia y sensibilidad táctil.',
     18000, 35000, 12, 5, 'unidad', true, 'public',
     'https://picsum.photos/seed/vidrio2/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Vidrio Templado Xiaomi Redmi Note 13 (Pack x2)', 'VID-XRN13-2', v_cat_protectores, 'Xiaomi', v_brand_xiaomi,
     'Pack de 2 vidrios 9H con bordes 2.5D. Antihuellas y anti-rayaduras.',
     8000, 15000, 30, 10, 'unidad', true, 'public',
     'https://picsum.photos/seed/vidrio3/400/400', false, now(), now()),

    -- CABLES
    (gen_random_uuid(), v_org_id, 'Cable Ugreen USB-C a USB-C 100W 2m', 'CAB-UG-CC100', v_cat_cables, 'Ugreen', v_brand_ugreen,
     'Cable USB-C 100W Power Delivery. Nylon trenzado, 2 metros. Ideal para laptop y celular.',
     15000, 28000, 18, 8, 'unidad', true, 'public',
     'https://picsum.photos/seed/cable1/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Cable Ugreen USB-C a Lightning MFi 1m', 'CAB-UG-CL-1M', v_cat_cables, 'Ugreen', v_brand_ugreen,
     'Cable certificado MFi para iPhone. Carga rápida 20W, nylon trenzado durable.',
     12000, 22000, 15, 5, 'unidad', true, 'public',
     'https://picsum.photos/seed/cable2/400/400', false, now(), now()),

    (gen_random_uuid(), v_org_id, 'Cable Baseus USB-C Magnético 100W 1.5m', 'CAB-BS-MAG100', v_cat_cables, 'Baseus', v_brand_baseus,
     'Cable magnético con punta rotativa 180°. Carga rápida 100W, transferencia de datos.',
     20000, 38000, 10, 4, 'unidad', true, 'public',
     'https://picsum.photos/seed/cable3/400/400', true, now(), now()),

    (gen_random_uuid(), v_org_id, 'Cable Anker USB-C a USB-C 240W 1.8m', 'CAB-AN-CC240', v_cat_cables, 'Anker', v_brand_anker,
     'Cable premium 240W USB-C con E-Marker. Certificado USB-IF, transferencia 40Gbps.',
     25000, 45000, 7, 3, 'unidad', true, 'public',
     'https://picsum.photos/seed/cable4/400/400', false, now(), now())

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed completado: 8 marcas, 5 categorías de venta y 20 productos públicos con imágenes creados para hca.celulares@gmail.com';
END;
$$;
