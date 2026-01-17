-- ============================================
-- SCRIPT AUTOMÁTICO - Datos de Prueba Crédito
-- ============================================
-- Este script usa automáticamente los primeros 4 clientes
-- Solo copia y pega en Supabase SQL Editor
-- ============================================

-- Crear función helper
CREATE OR REPLACE FUNCTION create_test_credit(
  p_customer_id UUID,
  p_principal NUMERIC,
  p_term_months INTEGER,
  p_paid_installments INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_credit_id UUID;
  v_installment_amount NUMERIC;
  i INTEGER;
BEGIN
  INSERT INTO customer_credits (
    customer_id, principal, interest_rate, term_months,
    start_date, status, created_at, updated_at
  ) VALUES (
    p_customer_id, p_principal, 0, p_term_months,
    CURRENT_DATE - INTERVAL '1 month', 'active', NOW(), NOW()
  ) RETURNING id INTO v_credit_id;

  v_installment_amount := ROUND(p_principal / p_term_months, 0);

  FOR i IN 1..p_term_months LOOP
    INSERT INTO credit_installments (
      credit_id, installment_number, due_date, amount, status,
      paid_at, payment_method, amount_paid, created_at
    ) VALUES (
      v_credit_id, i,
      CURRENT_DATE + ((i - 1) || ' months')::INTERVAL,
      v_installment_amount,
      CASE 
        WHEN i <= p_paid_installments THEN 'paid'
        WHEN i = p_paid_installments + 1 AND p_paid_installments > 0 THEN 'late'
        ELSE 'pending'
      END,
      CASE WHEN i <= p_paid_installments THEN NOW() ELSE NULL END,
      CASE WHEN i <= p_paid_installments THEN 'cash' ELSE NULL END,
      CASE WHEN i <= p_paid_installments THEN v_installment_amount ELSE NULL END,
      NOW()
    );
  END LOOP;

  IF p_paid_installments > 0 THEN
    INSERT INTO credit_payments (credit_id, installment_id, amount, payment_method, created_at, notes)
    SELECT v_credit_id, id, amount, 'cash', NOW(), 'Pago cuota ' || installment_number
    FROM credit_installments
    WHERE credit_id = v_credit_id AND installment_number <= p_paid_installments;
  END IF;

  RETURN v_credit_id;
END;
$$ LANGUAGE plpgsql;

-- Configurar límites de crédito en los primeros 4 clientes
DO $$
DECLARE
  customer_ids UUID[];
BEGIN
  -- Obtener los primeros 4 clientes
  SELECT ARRAY_AGG(id) INTO customer_ids
  FROM (SELECT id FROM customers ORDER BY created_at LIMIT 4) sub;

  -- Cliente 1: Límite 5M
  IF customer_ids[1] IS NOT NULL THEN
    UPDATE customers SET credit_limit = 5000000 WHERE id = customer_ids[1];
    PERFORM create_test_credit(customer_ids[1], 2000000, 12, 3);
    RAISE NOTICE 'Cliente 1 configurado: %', customer_ids[1];
  END IF;

  -- Cliente 2: Límite 10M
  IF customer_ids[2] IS NOT NULL THEN
    UPDATE customers SET credit_limit = 10000000 WHERE id = customer_ids[2];
    PERFORM create_test_credit(customer_ids[2], 3000000, 12, 2);
    RAISE NOTICE 'Cliente 2 configurado: %', customer_ids[2];
  END IF;

  -- Cliente 3: Sin crédito
  IF customer_ids[3] IS NOT NULL THEN
    UPDATE customers SET credit_limit = 0 WHERE id = customer_ids[3];
    RAISE NOTICE 'Cliente 3 configurado (sin crédito): %', customer_ids[3];
  END IF;

  -- Cliente 4: Al límite
  IF customer_ids[4] IS NOT NULL THEN
    UPDATE customers SET credit_limit = 3000000 WHERE id = customer_ids[4];
    PERFORM create_test_credit(customer_ids[4], 3000000, 12, 0);
    RAISE NOTICE 'Cliente 4 configurado (al límite): %', customer_ids[4];
  END IF;
END $$;

-- Verificar resultados
SELECT 
  c.name as cliente,
  c.credit_limit as limite,
  COUNT(DISTINCT cc.id) as creditos,
  COUNT(ci.id) as cuotas_total,
  SUM(CASE WHEN ci.status = 'paid' THEN 1 ELSE 0 END) as cuotas_pagadas,
  SUM(CASE WHEN ci.status IN ('pending', 'late') THEN 1 ELSE 0 END) as cuotas_pendientes,
  SUM(CASE WHEN ci.status IN ('pending', 'late') THEN ci.amount ELSE 0 END) as saldo_usado,
  c.credit_limit - COALESCE(SUM(CASE WHEN ci.status IN ('pending', 'late') THEN ci.amount ELSE 0 END), 0) as disponible,
  ROUND(
    COALESCE(SUM(CASE WHEN ci.status IN ('pending', 'late') THEN ci.amount ELSE 0 END), 0) * 100.0 / 
    NULLIF(c.credit_limit, 0), 
    1
  ) as utilizacion_pct
FROM customers c
LEFT JOIN customer_credits cc ON cc.customer_id = c.id AND cc.status = 'active'
LEFT JOIN credit_installments ci ON ci.credit_id = cc.id
WHERE c.id IN (SELECT id FROM customers ORDER BY created_at LIMIT 4)
GROUP BY c.id, c.name, c.credit_limit
ORDER BY c.created_at;

-- Mostrar IDs para referencia
SELECT 
  ROW_NUMBER() OVER (ORDER BY created_at) as numero,
  id,
  name,
  email,
  credit_limit
FROM customers 
ORDER BY created_at 
LIMIT 4;
