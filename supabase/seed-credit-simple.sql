-- ============================================
-- SCRIPT SIMPLIFICADO - Datos de Prueba Crédito
-- ============================================
-- Ejecuta este script paso a paso en Supabase SQL Editor
-- ============================================

-- PASO 1: Obtener IDs de clientes existentes
-- Copia los IDs que necesites de aquí
SELECT id, name, email FROM customers LIMIT 10;

-- ============================================
-- PASO 2: Configurar límites de crédito
-- ============================================
-- REEMPLAZA los IDs con los que copiaste arriba

-- Cliente 1: Con crédito activo y cuotas pagadas
UPDATE customers SET credit_limit = 5000000 WHERE id = 'TU_CUSTOMER_ID_1';

-- Cliente 2: Con múltiples créditos
UPDATE customers SET credit_limit = 10000000 WHERE id = 'TU_CUSTOMER_ID_2';

-- Cliente 3: Sin crédito configurado
UPDATE customers SET credit_limit = 0 WHERE id = 'TU_CUSTOMER_ID_3';

-- Cliente 4: Al límite de crédito
UPDATE customers SET credit_limit = 3000000 WHERE id = 'TU_CUSTOMER_ID_4';

-- ============================================
-- PASO 3: Crear créditos y cuotas
-- ============================================

-- FUNCIÓN HELPER: Crear crédito con cuotas automáticas
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
  -- Crear el crédito
  INSERT INTO customer_credits (
    customer_id,
    principal,
    interest_rate,
    term_months,
    start_date,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_customer_id,
    p_principal,
    0,
    p_term_months,
    CURRENT_DATE - INTERVAL '1 month',
    'active',
    NOW(),
    NOW()
  ) RETURNING id INTO v_credit_id;

  -- Calcular monto de cada cuota
  v_installment_amount := p_principal / p_term_months;

  -- Crear las cuotas
  FOR i IN 1..p_term_months LOOP
    INSERT INTO credit_installments (
      credit_id,
      installment_number,
      due_date,
      amount,
      status,
      paid_at,
      payment_method,
      amount_paid,
      created_at
    ) VALUES (
      v_credit_id,
      i,
      CURRENT_DATE + ((i - 1) || ' months')::INTERVAL,
      v_installment_amount,
      CASE 
        WHEN i <= p_paid_installments THEN 'paid'
        WHEN i = p_paid_installments + 1 AND p_paid_installments > 0 THEN 'late'
        ELSE 'pending'
      END,
      CASE WHEN i <= p_paid_installments THEN NOW() - ((p_paid_installments - i) || ' days')::INTERVAL ELSE NULL END,
      CASE WHEN i <= p_paid_installments THEN 'cash' ELSE NULL END,
      CASE WHEN i <= p_paid_installments THEN v_installment_amount ELSE NULL END,
      NOW()
    );
  END LOOP;

  -- Registrar pagos
  IF p_paid_installments > 0 THEN
    FOR i IN 1..p_paid_installments LOOP
      INSERT INTO credit_payments (
        credit_id,
        installment_id,
        amount,
        payment_method,
        created_at,
        notes
      )
      SELECT 
        v_credit_id,
        id,
        amount,
        'cash',
        NOW() - ((p_paid_installments - i) || ' days')::INTERVAL,
        'Pago cuota ' || installment_number
      FROM credit_installments
      WHERE credit_id = v_credit_id AND installment_number = i;
    END LOOP;
  END IF;

  RETURN v_credit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PASO 4: Crear datos de prueba
-- ============================================
-- REEMPLAZA los IDs con los que copiaste en PASO 1

-- Cliente 1: Crédito de 2M, 12 cuotas, 3 pagadas
SELECT create_test_credit(
  'TU_CUSTOMER_ID_1'::UUID,  -- REEMPLAZAR
  2000000,                    -- 2 millones
  12,                         -- 12 meses
  3                           -- 3 cuotas pagadas
);

-- Cliente 2: Crédito de 3M, 12 cuotas, 2 pagadas
SELECT create_test_credit(
  'TU_CUSTOMER_ID_2'::UUID,  -- REEMPLAZAR
  3000000,                    -- 3 millones
  12,                         -- 12 meses
  2                           -- 2 cuotas pagadas
);

-- Cliente 4: Crédito de 3M, 12 cuotas, 0 pagadas (al límite)
SELECT create_test_credit(
  'TU_CUSTOMER_ID_4'::UUID,  -- REEMPLAZAR
  3000000,                    -- 3 millones
  12,                         -- 12 meses
  0                           -- Sin pagos
);

-- ============================================
-- PASO 5: VERIFICAR DATOS
-- ============================================

-- Ver resumen por cliente
SELECT 
  c.name,
  c.credit_limit,
  COUNT(DISTINCT cc.id) as total_credits,
  COUNT(ci.id) as total_installments,
  SUM(CASE WHEN ci.status = 'pending' OR ci.status = 'late' THEN ci.amount ELSE 0 END) as balance_pending,
  c.credit_limit - SUM(CASE WHEN ci.status = 'pending' OR ci.status = 'late' THEN ci.amount ELSE 0 END) as available_credit
FROM customers c
LEFT JOIN customer_credits cc ON cc.customer_id = c.id AND cc.status = 'active'
LEFT JOIN credit_installments ci ON ci.credit_id = cc.id
WHERE c.credit_limit > 0
GROUP BY c.id, c.name, c.credit_limit
ORDER BY c.name;

-- Ver detalle de cuotas
SELECT 
  c.name as cliente,
  cc.principal as monto_credito,
  ci.installment_number as cuota,
  ci.amount as monto_cuota,
  ci.due_date as vencimiento,
  ci.status as estado,
  ci.paid_at as fecha_pago
FROM credit_installments ci
JOIN customer_credits cc ON cc.id = ci.credit_id
JOIN customers c ON c.id = cc.customer_id
ORDER BY c.name, ci.installment_number;

-- ============================================
-- PASO 6: LIMPIAR (si necesitas empezar de nuevo)
-- ============================================

-- CUIDADO: Esto borra TODOS los datos de crédito
-- Descomenta solo si necesitas limpiar

/*
DELETE FROM credit_payments;
DELETE FROM credit_installments;
DELETE FROM customer_credits;
UPDATE customers SET credit_limit = 0, current_balance = 0;
DROP FUNCTION IF EXISTS create_test_credit;
*/

-- ============================================
-- VALORES ESPERADOS DESPUÉS DE EJECUTAR
-- ============================================

/*
Cliente 1:
- Límite: 5,000,000
- Crédito usado: 1,500,003 (9 cuotas pendientes)
- Disponible: 3,499,997
- Utilización: 30%

Cliente 2:
- Límite: 10,000,000
- Crédito usado: 2,500,000 (10 cuotas pendientes)
- Disponible: 7,500,000
- Utilización: 25%

Cliente 3:
- Sin crédito configurado
- Debe mostrar: "Cliente sin crédito configurado"

Cliente 4:
- Límite: 3,000,000
- Crédito usado: 3,000,000 (12 cuotas pendientes)
- Disponible: 0
- Utilización: 100%
*/
