-- =========================================================================
-- MIGRACIÓN: ENLAZAR CUOTAS DE CRÉDITO CON VENTAS Y PRODUCTOS
-- =========================================================================

-- 1. Agregar columna sale_id a credit_installments (referencia a la venta de origen)
ALTER TABLE credit_installments 
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;

-- 2. Recrear la vista credit_installments_progress para incluir la columna sale_id
DROP VIEW IF EXISTS credit_installments_progress;

CREATE OR REPLACE VIEW credit_installments_progress AS
SELECT 
  i.id,
  i.credit_id,
  i.sale_id, -- Enlace agregado a la vista de progreso
  i.installment_number,
  i.due_date,
  i.amount,
  COALESCE(i.amount_paid, 0) AS amount_paid,
  CASE 
    WHEN COALESCE(i.amount_paid, 0) >= i.amount THEN 'paid'
    WHEN i.due_date < NOW() THEN 'late'
    ELSE 'pending'
  END AS status_effective,
  CASE 
    WHEN i.amount > 0 THEN LEAST(100, ROUND((COALESCE(i.amount_paid, 0) / i.amount) * 100)::INT)
    ELSE 0
  END AS progreso
FROM credit_installments i;

GRANT SELECT ON credit_installments_progress TO authenticated;
