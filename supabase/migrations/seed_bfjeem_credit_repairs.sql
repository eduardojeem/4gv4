-- Seed de datos de ejemplo para cliente por email
DO $$
DECLARE
  v_email TEXT := 'bfjeem@gmail.com';
  v_profile UUID;
  v_customer UUID;
  v_credit UUID;
  v_term INTEGER := 6;
  v_principal NUMERIC := 600;
  v_interest NUMERIC := 0.12; -- 12%
  v_amount NUMERIC := ROUND((v_principal / v_term) + ((v_principal * v_interest) / v_term), 2);
  i INTEGER;
BEGIN
  -- 1) Obtener perfil por email (si existe)
  SELECT id INTO v_profile FROM public.profiles WHERE email = v_email LIMIT 1;

  -- 2) Obtener o crear cliente por email
  SELECT id INTO v_customer FROM public.customers WHERE email = v_email LIMIT 1;
  IF v_customer IS NULL THEN
    INSERT INTO public.customers (
      name, email, phone, customer_type, status, segment, address, city, profile_id
    ) VALUES (
      'BF Jeem', v_email, '+593999000111', 'regular', 'active', 'regular', 'Centro', 'Guayaquil', v_profile
    ) RETURNING id INTO v_customer;
  END IF;

  -- 3) Crear una reparación de ejemplo si no existe alguna reciente
  IF NOT EXISTS (
    SELECT 1 FROM public.repairs WHERE customer_id = v_customer AND received_at > NOW() - INTERVAL '60 days'
  ) THEN
    INSERT INTO public.repairs (
      customer_id, device_brand, device_model, serial_number, problem_description,
      status, received_at, notes
    ) VALUES (
      v_customer, 'Samsung', 'Galaxy S21', 'SN-BFJ-001', 'Pantalla quebrada y batería defectuosa',
      'recibido', NOW() - INTERVAL '10 days', 'Equipo recibido con accesorios completos'
    );

    INSERT INTO public.repairs (
      customer_id, device_brand, device_model, serial_number, problem_description,
      status, received_at, notes
    ) VALUES (
      v_customer, 'Apple', 'iPhone 12', 'SN-BFJ-002', 'Cámara trasera no enfoca',
      'diagnostico', NOW() - INTERVAL '25 days', 'Pendiente cotización de repuesto'
    );
  END IF;

  -- 4) Crear crédito de ejemplo si el cliente no tiene uno activo
  SELECT id INTO v_credit FROM public.customer_credits WHERE customer_id = v_customer AND status = 'active' LIMIT 1;
  IF v_credit IS NULL THEN
    INSERT INTO public.customer_credits (
      customer_id, principal, interest_rate, term_months, start_date, status
    ) VALUES (
      v_customer, v_principal, v_interest, v_term, NOW() - INTERVAL '15 days', 'active'
    ) RETURNING id INTO v_credit;

    -- 5) Crear cuotas mensuales
    FOR i IN 1..v_term LOOP
      INSERT INTO public.credit_installments (
        credit_id, installment_number, due_date, amount, principal_component, interest_component, status
      ) VALUES (
        v_credit, i, (date_trunc('day', NOW()) + (i * INTERVAL '1 month')), v_amount,
        ROUND(v_principal / v_term, 2), ROUND((v_principal * v_interest) / v_term, 2), 'pending'
      );
    END LOOP;

    -- 6) Registrar un pago parcial de la primera cuota
    PERFORM id FROM public.credit_installments WHERE credit_id = v_credit AND installment_number = 1 LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.credit_payments (
        credit_id, installment_id, amount, payment_method, notes
      ) SELECT v_credit, id, v_amount, 'cash', 'Pago de demostración'
      FROM public.credit_installments 
      WHERE credit_id = v_credit AND installment_number = 1
      LIMIT 1;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ Seed de reparaciones y créditos creado para %', 'bfjeem@gmail.com';
END $$;
