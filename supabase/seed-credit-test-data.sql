-- ============================================
-- Script de Datos de Prueba - Sistema de Crédito
-- ============================================
-- Este script crea datos de prueba para demostrar
-- la sincronización del sistema de crédito entre
-- POS y Customers
-- ============================================

-- IMPORTANTE: Ajusta los IDs de clientes según tu base de datos
-- Puedes obtener IDs reales ejecutando:
-- SELECT id, name FROM customers LIMIT 5;

-- ============================================
-- 1. CLIENTE CON CRÉDITO ACTIVO
-- ============================================

-- Actualizar límite de crédito del cliente
-- REEMPLAZA 'CUSTOMER_ID_1' con un ID real de tu tabla customers
UPDATE customers 
SET 
  credit_limit = 5000000,  -- 5 millones de guaraníes
  current_balance = 0
WHERE id = 'CUSTOMER_ID_1';

-- Crear un crédito activo
INSERT INTO customer_credits (
  id,
  customer_id,
  principal,
  interest_rate,
  term_months,
  start_date,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CUSTOMER_ID_1',
  2000000,  -- 2 millones
  0,        -- Sin interés
  12,       -- 12 meses
  '2024-12-01',
  'active',
  NOW(),
  NOW()
) RETURNING id;

-- Guardar el ID del crédito para usarlo en las cuotas
-- Ejecuta esto después de obtener el ID del crédito anterior
-- REEMPLAZA 'CREDIT_ID_1' con el ID generado

-- Crear 12 cuotas mensuales
DO $$
DECLARE
  credit_id_var UUID := 'CREDIT_ID_1';  -- REEMPLAZAR con ID real
  installment_amount NUMERIC := 166667; -- 2,000,000 / 12
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    INSERT INTO credit_installments (
      id,
      credit_id,
      installment_number,
      due_date,
      amount,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      credit_id_var,
      i,
      ('2024-12-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      installment_amount,
      CASE 
        WHEN i <= 3 THEN 'paid'::text     -- Primeras 3 cuotas pagadas
        WHEN i = 4 THEN 'late'::text      -- Cuota 4 vencida
        ELSE 'pending'::text              -- Resto pendientes
      END,
      NOW()
    );
  END LOOP;
END $$;

-- Registrar pagos de las 3 primeras cuotas
-- REEMPLAZA 'CREDIT_ID_1' con el ID real
INSERT INTO credit_payments (
  id,
  credit_id,
  amount,
  payment_method,
  created_at,
  notes
)
SELECT 
  gen_random_uuid(),
  'CREDIT_ID_1',
  166667,
  'cash',
  NOW() - (interval '1 month' * (4 - installment_number)),
  'Pago cuota ' || installment_number
FROM credit_installments
WHERE credit_id = 'CREDIT_ID_1' 
  AND installment_number <= 3;

-- ============================================
-- 2. CLIENTE CON MÚLTIPLES CRÉDITOS
-- ============================================

-- REEMPLAZA 'CUSTOMER_ID_2' con otro ID real
UPDATE customers 
SET 
  credit_limit = 10000000,  -- 10 millones
  current_balance = 0
WHERE id = 'CUSTOMER_ID_2';

-- Crédito 1: Completado
INSERT INTO customer_credits (
  id,
  customer_id,
  principal,
  interest_rate,
  term_months,
  start_date,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CUSTOMER_ID_2',
  1500000,
  0,
  6,
  '2024-06-01',
  'completed',
  NOW() - INTERVAL '6 months',
  NOW()
);

-- Crédito 2: Activo
INSERT INTO customer_credits (
  id,
  customer_id,
  principal,
  interest_rate,
  term_months,
  start_date,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CUSTOMER_ID_2',
  3000000,
  0,
  12,
  '2024-11-01',
  'active',
  NOW() - INTERVAL '2 months',
  NOW()
) RETURNING id;

-- REEMPLAZA 'CREDIT_ID_2' con el ID generado arriba
DO $$
DECLARE
  credit_id_var UUID := 'CREDIT_ID_2';
  installment_amount NUMERIC := 250000; -- 3,000,000 / 12
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    INSERT INTO credit_installments (
      id,
      credit_id,
      installment_number,
      due_date,
      amount,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      credit_id_var,
      i,
      ('2024-11-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      installment_amount,
      CASE 
        WHEN i <= 2 THEN 'paid'::text
        ELSE 'pending'::text
      END,
      NOW()
    );
  END LOOP;
END $$;

-- ============================================
-- 3. CLIENTE SIN CRÉDITO CONFIGURADO
-- ============================================

-- REEMPLAZA 'CUSTOMER_ID_3' con otro ID real
UPDATE customers 
SET 
  credit_limit = 0,  -- Sin límite configurado
  current_balance = 0
WHERE id = 'CUSTOMER_ID_3';

-- ============================================
-- 4. CLIENTE CON CRÉDITO AL LÍMITE
-- ============================================

-- REEMPLAZA 'CUSTOMER_ID_4' con otro ID real
UPDATE customers 
SET 
  credit_limit = 3000000,
  current_balance = 0
WHERE id = 'CUSTOMER_ID_4';

INSERT INTO customer_credits (
  id,
  customer_id,
  principal,
  interest_rate,
  term_months,
  start_date,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CUSTOMER_ID_4',
  3000000,
  0,
  12,
  '2025-01-01',
  'active',
  NOW(),
  NOW()
) RETURNING id;

-- REEMPLAZA 'CREDIT_ID_4' con el ID generado
DO $$
DECLARE
  credit_id_var UUID := 'CREDIT_ID_4';
  installment_amount NUMERIC := 250000;
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    INSERT INTO credit_installments (
      id,
      credit_id,
      installment_number,
      due_date,
      amount,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      credit_id_var,
      i,
      ('2025-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      installment_amount,
      'pending',
      NOW()
    );
  END LOOP;
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver clientes con sus límites de crédito
SELECT 
  id,
  name,
  credit_limit,
  current_balance
FROM customers
WHERE credit_limit > 0
ORDER BY name;

-- Ver créditos creados
SELECT 
  cc.id,
  c.name as customer_name,
  cc.principal,
  cc.term_months,
  cc.status,
  cc.start_date
FROM customer_credits cc
JOIN customers c ON c.id = cc.customer_id
ORDER BY cc.created_at DESC;

-- Ver cuotas pendientes por cliente
SELECT 
  c.name as customer_name,
  COUNT(*) as total_installments,
  SUM(CASE WHEN ci.status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN ci.status = 'paid' THEN 1 ELSE 0 END) as paid,
  SUM(CASE WHEN ci.status = 'late' THEN 1 ELSE 0 END) as late,
  SUM(CASE WHEN ci.status = 'pending' OR ci.status = 'late' THEN ci.amount ELSE 0 END) as total_pending_amount
FROM credit_installments ci
JOIN customer_credits cc ON cc.id = ci.credit_id
JOIN customers c ON c.id = cc.customer_id
GROUP BY c.name
ORDER BY c.name;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

/*
ANTES DE EJECUTAR:

1. Obtén IDs reales de clientes:
   SELECT id, name FROM customers LIMIT 5;

2. Reemplaza todos los 'CUSTOMER_ID_X' con IDs reales

3. Ejecuta el script en bloques:
   - Primero la sección del Cliente 1
   - Obtén el ID del crédito generado
   - Reemplaza 'CREDIT_ID_1' en el bloque de cuotas
   - Repite para cada cliente

4. Verifica los datos con las consultas de VERIFICACIÓN

DESPUÉS DE EJECUTAR:

1. Ve a Dashboard → Customers
2. Busca los clientes que configuraste
3. Verifica que muestren información de crédito

4. Ve a Dashboard → POS
5. Selecciona los mismos clientes
6. Verifica que muestren los mismos valores

VALORES ESPERADOS:

Cliente 1 (CUSTOMER_ID_1):
- Límite: 5,000,000
- Usado: 1,500,000 (9 cuotas pendientes de 166,667)
- Disponible: 3,500,000
- Utilización: 30%

Cliente 2 (CUSTOMER_ID_2):
- Límite: 10,000,000
- Usado: 2,500,000 (10 cuotas pendientes de 250,000)
- Disponible: 7,500,000
- Utilización: 25%

Cliente 3 (CUSTOMER_ID_3):
- Sin crédito configurado
- Debe mostrar mensaje apropiado

Cliente 4 (CUSTOMER_ID_4):
- Límite: 3,000,000
- Usado: 3,000,000 (12 cuotas pendientes)
- Disponible: 0
- Utilización: 100%
*/
