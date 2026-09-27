DO $$
DECLARE
  v_user_id uuid;
  v_customer_id uuid;
  v_profile_exists boolean := false;
  v_customer_exists boolean := false;
  v_product_ids uuid[] := ARRAY[]::uuid[];
  v_product_id uuid;
  v_price numeric;
  v_sale_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Obtener el usuario por email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bfjeem@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario bfjeem@gmail.com no existe en auth.users';
    RETURN;
  END IF;

  -- Asegurar perfil
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (v_user_id, 'bfjeem@gmail.com', 'Cliente BFJEEM', 'cliente');
  END IF;

  -- Asegurar cliente vinculado
  SELECT EXISTS(SELECT 1 FROM customers WHERE profile_id = v_user_id) INTO v_customer_exists;
  IF NOT v_customer_exists THEN
    INSERT INTO customers (profile_id, name, first_name, last_name, email, phone, customer_type, segment, city)
    VALUES (v_user_id, 'Cliente BFJEEM', 'Cliente', 'BFJEEM', 'bfjeem@gmail.com', '+595 987 654321', 'regular', 'regular', 'Asunción');
  END IF;

  -- Obtener customer_id
  SELECT id INTO v_customer_id FROM customers WHERE profile_id = v_user_id;

  -- Asegurar al menos 2 productos activos de ejemplo si no existen
  SELECT array_agg(id) INTO v_product_ids
  FROM (
    SELECT id FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 2
  ) t;

  IF v_product_ids IS NULL OR array_length(v_product_ids, 1) < 2 THEN
    INSERT INTO products (name, sku, purchase_price, sale_price, stock_quantity, is_active, brand)
    VALUES
      ('Cable USB-C 1m', 'SKU-CABLE-USBC-1M', 15000, 25000, 50, true, 'Generic'),
      ('Funda Silicona', 'SKU-FUNDA-NEGRA', 20000, 35000, 30, true, 'Generic');

    -- Releer ids
    SELECT array_agg(id) INTO v_product_ids
    FROM (
      SELECT id FROM products WHERE sku IN ('SKU-CABLE-USBC-1M', 'SKU-FUNDA-NEGRA') ORDER BY created_at DESC
    ) t;
  END IF;

  -- Crear VENTA 1 (efectivo)
  SELECT sale_price INTO v_price FROM products WHERE id = v_product_ids[1];
  INSERT INTO sales (code, total_amount, subtotal_amount, tax_amount, discount_amount, payment_method, payment_status, status, customer_id, created_by, created_at)
  VALUES (
    'CLI-' || substr(gen_random_uuid()::text, 1, 8),
    v_price,
    v_price,
    0,
    0,
    'efectivo',
    'completed',
    'completed',
    v_customer_id,
    v_user_id,
    v_now - interval '10 days'
  ) RETURNING id INTO v_sale_id;

  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, subtotal, created_at)
  VALUES (v_sale_id, v_product_ids[1], 1, v_price, 0, v_price, v_now - interval '10 days');

  UPDATE products SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - 1) WHERE id = v_product_ids[1];

  -- Crear VENTA 2 (transferencia, con 2 ítems)
  SELECT sale_price INTO v_price FROM products WHERE id = v_product_ids[2];
  INSERT INTO sales (code, total_amount, subtotal_amount, tax_amount, discount_amount, payment_method, payment_status, status, customer_id, created_by, created_at)
  VALUES (
    'CLI-' || substr(gen_random_uuid()::text, 1, 8),
    v_price * 2,
    v_price * 2,
    0,
    0,
    'transferencia',
    'completed',
    'completed',
    v_customer_id,
    v_user_id,
    v_now - interval '3 days'
  ) RETURNING id INTO v_sale_id;

  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, subtotal, created_at)
  VALUES (v_sale_id, v_product_ids[2], 2, v_price, 0, v_price * 2, v_now - interval '3 days');

  UPDATE products SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - 2) WHERE id = v_product_ids[2];

  -- Crear REPARACIÓN 1 (entregado, pagado)
  INSERT INTO repairs (
    customer_id, device_type, device_brand, device_model, problem_description,
    status, technician_id, final_cost, paid_amount, received_at, completed_at, delivered_at, location
  ) VALUES (
    v_customer_id, 'smartphone', 'Samsung', 'Galaxy S21', 'Pantalla rota',
    'entregado', NULL, 450000, 450000, v_now - interval '20 days', v_now - interval '18 days', v_now - interval '17 days', 'Taller Principal'
  );

  -- Crear REPARACIÓN 2 (en proceso, con estimado)
  INSERT INTO repairs (
    customer_id, device_type, device_brand, device_model, problem_description,
    status, technician_id, estimated_cost, received_at, location
  ) VALUES (
    v_customer_id, 'smartphone', 'Xiaomi', 'Redmi Note 10', 'No carga la batería',
    'reparacion', NULL, 250000, v_now - interval '5 days', 'Taller Principal'
  );

  RAISE NOTICE 'Datos de ejemplo creados para bfjeem@gmail.com';
END $$;

