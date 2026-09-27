DO $$
DECLARE
  v_user_id uuid;
  v_customer_id uuid;
  v_profile_exists boolean := false;
  v_customer_exists boolean := false;
  v_product_id uuid;
  v_unit_price numeric;
  v_sale_id uuid;
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
    INSERT INTO customers (profile_id, name, first_name, last_name, email, phone, customer_type, segment)
    VALUES (v_user_id, 'Cliente BFJEEM', 'Cliente', 'BFJEEM', 'bfjeem@gmail.com', '', 'regular', 'regular');
  END IF;

  -- Obtener customer_id
  SELECT id INTO v_customer_id FROM customers WHERE profile_id = v_user_id;

  -- Elegir un producto activo
  SELECT id, sale_price INTO v_product_id, v_unit_price
  FROM products
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_product_id IS NULL THEN
    RAISE NOTICE 'No hay productos activos para crear la venta de prueba';
    RETURN;
  END IF;

  -- Crear venta con esquema actual
  INSERT INTO sales (code, total_amount, subtotal_amount, tax_amount, discount_amount, payment_method, status, customer_id, created_by)
  VALUES (
    'TEST-' || substr(gen_random_uuid()::text, 1, 8),
    v_unit_price,
    v_unit_price,
    0,
    0,
    'efectivo',
    'completed',
    v_customer_id,
    v_user_id
  ) RETURNING id INTO v_sale_id;

  -- Insertar ítem de venta
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, subtotal)
  VALUES (v_sale_id, v_product_id, 1, v_unit_price, 0, v_unit_price);

  -- Ajustar stock (si existe columna)
  UPDATE products SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - 1)
  WHERE id = v_product_id;

  RAISE NOTICE 'Venta de prueba creada para bfjeem@gmail.com: %', v_sale_id;
END $$;
