-- ============================================================================
-- Fix Credits Module: Views + RLS + Data Verification
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Verify tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_credits') THEN
    RAISE NOTICE 'ERROR: Table customer_credits does NOT exist. Run the full credits migration first.';
  ELSE
    RAISE NOTICE 'OK: customer_credits exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_installments') THEN
    RAISE NOTICE 'ERROR: Table credit_installments does NOT exist.';
  ELSE
    RAISE NOTICE 'OK: credit_installments exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_payments') THEN
    RAISE NOTICE 'ERROR: Table credit_payments does NOT exist.';
  ELSE
    RAISE NOTICE 'OK: credit_payments exists';
  END IF;
END $$;

-- 2. Check row counts
SELECT 'customer_credits' AS table_name, COUNT(*) AS row_count FROM customer_credits
UNION ALL
SELECT 'credit_installments', COUNT(*) FROM credit_installments
UNION ALL
SELECT 'credit_payments', COUNT(*) FROM credit_payments;

-- 3. Fix credit_details view (handle both name column variants)
DROP VIEW IF EXISTS credit_details;
CREATE VIEW credit_details AS
SELECT 
  cc.*,
  COALESCE(
    c.name,
    CONCAT_WS(' ', c.first_name, c.last_name),
    'Sin nombre'
  ) AS customer_name
FROM customer_credits cc
LEFT JOIN customers c ON c.id = cc.customer_id;

GRANT SELECT ON credit_details TO authenticated;

-- 4. Recreate credit_summary view (DROP first to avoid column type conflicts)
DROP VIEW IF EXISTS credit_summary;
CREATE VIEW credit_summary AS
WITH inst AS (
  SELECT 
    credit_id,
    COUNT(*)::NUMERIC AS total_installments,
    COALESCE(SUM(amount), 0) AS total_principal,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE COALESCE(amount_paid, 0) END), 0) AS total_pagado,
    COALESCE(SUM(CASE WHEN status != 'paid' THEN amount - COALESCE(amount_paid, 0) ELSE 0 END), 0) AS saldo_pendiente
  FROM credit_installments
  GROUP BY credit_id
)
SELECT 
  c.id AS credit_id,
  COALESCE(inst.total_principal, c.principal) AS total_principal,
  COALESCE(inst.total_installments, 0::NUMERIC) AS total_installments,
  COALESCE(inst.total_pagado, 0::NUMERIC) AS total_pagado,
  COALESCE(inst.saldo_pendiente, c.principal) AS saldo_pendiente,
  CASE 
    WHEN COALESCE(inst.total_principal, c.principal) > 0 
    THEN ROUND((COALESCE(inst.total_pagado, 0) / COALESCE(inst.total_principal, c.principal)) * 100, 1)
    ELSE 0 
  END AS progreso
FROM customer_credits c
LEFT JOIN inst ON inst.credit_id = c.id;

GRANT SELECT ON credit_summary TO authenticated;

-- 5. Recreate credit_installments_progress view
DROP VIEW IF EXISTS credit_installments_progress;
CREATE VIEW credit_installments_progress AS
SELECT 
  i.id,
  CASE 
    WHEN i.amount > 0 THEN ROUND((COALESCE(i.amount_paid, 0) / i.amount) * 100, 1)
    ELSE 0 
  END AS progreso,
  CASE
    WHEN i.status = 'paid' THEN 'paid'
    WHEN i.due_date < NOW() AND i.status != 'paid' THEN 'late'
    ELSE 'pending'
  END AS status_effective
FROM credit_installments i;

GRANT SELECT ON credit_installments_progress TO authenticated;

-- 6. Ensure RLS policies allow reading
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated can read credits" ON customer_credits;
DROP POLICY IF EXISTS "Authenticated can read installments" ON credit_installments;
DROP POLICY IF EXISTS "Authenticated can read payments" ON credit_payments;
DROP POLICY IF EXISTS "Staff can manage credits" ON customer_credits;
DROP POLICY IF EXISTS "Staff can manage installments" ON credit_installments;
DROP POLICY IF EXISTS "Staff can manage payments" ON credit_payments;

-- Read access for all authenticated users
CREATE POLICY "Authenticated can read credits" ON customer_credits
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read installments" ON credit_installments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read payments" ON credit_payments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Write access for staff (admin + vendedor)
CREATE POLICY "Staff can manage credits" ON customer_credits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'vendedor'))
  );

CREATE POLICY "Staff can manage installments" ON credit_installments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'vendedor'))
  );

CREATE POLICY "Staff can manage payments" ON credit_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'vendedor'))
  );

-- 7. Verify final state
SELECT 'credit_details' AS view_name, COUNT(*) AS rows FROM credit_details
UNION ALL
SELECT 'credit_summary', COUNT(*) FROM credit_summary
UNION ALL
SELECT 'credit_installments_progress', COUNT(*) FROM credit_installments_progress;
