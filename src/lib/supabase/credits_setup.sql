-- =====================================================
-- TABLAS DE CRÉDITOS Y CUOTAS CON AUDITORÍA DE PAGOS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de créditos por cliente
CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  principal NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  term_months INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT CHECK (status IN ('active','completed','defaulted','cancelled')) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);

-- Tabla de cuotas de un crédito
CREATE TABLE IF NOT EXISTS credit_installments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credit_id UUID REFERENCES customer_credits(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT CHECK (status IN ('pending','paid','late')) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ NULL,
  payment_method TEXT NULL,
  amount_paid NUMERIC(12,2) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(credit_id, installment_number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_credit_installments_credit_id ON credit_installments(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_installments_due_date ON credit_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);

-- Alter para asegurar columnas de auditoría (si ya existe la tabla)
ALTER TABLE credit_installments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NULL;
DO $$
BEGIN
  ALTER TABLE credit_installments
    ADD CONSTRAINT credit_installments_payment_method_valid
    CHECK (payment_method IS NULL OR payment_method IN ('cash','card','transfer'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- Ensure get_user_role() exists (dev setup)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.user_roles 
    WHERE user_id = user_uuid 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas simples (idempotentes)
DROP POLICY IF EXISTS "Read customer credits" ON customer_credits;
CREATE POLICY "Read customer credits" ON customer_credits
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Manage customer credits" ON customer_credits;
CREATE POLICY "Manage customer credits" ON customer_credits
  FOR ALL USING (public.get_user_role() IN ('admin','super_admin'));

DROP POLICY IF EXISTS "Read credit installments" ON credit_installments;
CREATE POLICY "Read credit installments" ON credit_installments
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Manage credit installments" ON credit_installments;
CREATE POLICY "Manage credit installments" ON credit_installments
  FOR ALL USING (public.get_user_role() IN ('admin','super_admin'));

-- Trigger update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_credits_updated_at ON customer_credits;
CREATE TRIGGER update_customer_credits_updated_at
  BEFORE UPDATE ON customer_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_installments_updated_at ON credit_installments;
CREATE TRIGGER update_credit_installments_updated_at
  BEFORE UPDATE ON credit_installments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabla de pagos de crédito
CREATE TABLE IF NOT EXISTS credit_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES customer_credits(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES credit_installments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','card','transfer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_id ON credit_payments(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_installment_id ON credit_payments(installment_id);
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read credit payments" ON credit_payments;
CREATE POLICY "Read credit payments" ON credit_payments 
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Manage credit payments" ON credit_payments;
CREATE POLICY "Manage credit payments" ON credit_payments 
  FOR ALL USING (public.get_user_role() IN ('admin','super_admin'));

-- Consolidación automática de pagos en cuotas
CREATE OR REPLACE FUNCTION apply_installment_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst_id UUID;
  credit UUID;
  total NUMERIC;
  inst_amount NUMERIC;
  inst_due TIMESTAMPTZ;
  new_status TEXT;
BEGIN
  inst_id := COALESCE(NEW.installment_id, OLD.installment_id);
  IF inst_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT credit_id, amount, due_date INTO credit, inst_amount, inst_due
  FROM credit_installments
  WHERE id = inst_id
  FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM credit_payments
  WHERE installment_id = inst_id;

  IF total >= inst_amount THEN
    UPDATE credit_installments
    SET amount_paid = total,
        status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
    WHERE id = inst_id;
  ELSE
    new_status := CASE WHEN inst_due < NOW() THEN 'late' ELSE 'pending' END;
    UPDATE credit_installments
    SET amount_paid = total,
        status = new_status,
        paid_at = NULL,
        updated_at = NOW()
    WHERE id = inst_id;
  END IF;

  IF credit IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM credit_installments WHERE credit_id = credit AND status <> 'paid') THEN
      UPDATE customer_credits SET status = 'completed', updated_at = NOW() WHERE id = credit;
    END IF;
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tr_credit_payments_insert ON credit_payments;
CREATE TRIGGER tr_credit_payments_insert
AFTER INSERT ON credit_payments
FOR EACH ROW
EXECUTE FUNCTION apply_installment_payment();

DROP TRIGGER IF EXISTS tr_credit_payments_update ON credit_payments;
CREATE TRIGGER tr_credit_payments_update
AFTER UPDATE ON credit_payments
FOR EACH ROW
EXECUTE FUNCTION apply_installment_payment();

DROP TRIGGER IF EXISTS tr_credit_payments_delete ON credit_payments;
CREATE TRIGGER tr_credit_payments_delete
AFTER DELETE ON credit_payments
FOR EACH ROW
EXECUTE FUNCTION apply_installment_payment();

-- Vista resumen por crédito
CREATE OR REPLACE VIEW credit_summary AS
WITH inst AS (
  SELECT 
    credit_id,
    COALESCE(SUM(amount), 0) AS total_installments,
    COALESCE(SUM(COALESCE(amount_paid, 0)), 0) AS total_paid
  FROM credit_installments
  GROUP BY credit_id
)
SELECT 
  c.id AS credit_id,
  c.principal AS total_principal,
  COALESCE(inst.total_installments, 0) AS total_installments,
  COALESCE(inst.total_paid, 0) AS total_pagado,
  GREATEST(COALESCE(inst.total_installments, 0) - COALESCE(inst.total_paid, 0), 0) AS saldo_pendiente,
  CASE 
    WHEN COALESCE(inst.total_installments, 0) > 0 THEN LEAST(100, ROUND((COALESCE(inst.total_paid, 0) / COALESCE(inst.total_installments, 0)) * 100)::INT)
    ELSE 0
  END AS progreso
FROM customer_credits c
LEFT JOIN inst ON inst.credit_id = c.id;
GRANT SELECT ON credit_summary TO authenticated;

-- Vista de progreso por cuota
CREATE OR REPLACE VIEW credit_installments_progress AS
SELECT 
  i.id,
  i.credit_id,
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

INSERT INTO customers (name, email, phone, city, customer_type, segment)
SELECT v.name, v.email, v.phone, v.city, v.customer_type, v.segment
FROM (
  VALUES
    ('Juan Pérez', 'juan.perez.demo@example.com', '+595 981 111 111', 'Asunción', 'regular', 'regular'),
    ('Ana Gómez', 'ana.gomez.demo@example.com', '+595 981 222 222', 'Luque', 'premium', 'premium'),
    ('Carlos Ruiz', 'carlos.ruiz.demo@example.com', '+595 981 333 333', 'San Lorenzo', 'regular', 'new')
) AS v(name, email, phone, city, customer_type, segment)
WHERE NOT EXISTS (SELECT 1 FROM customers);

WITH new_credits AS (
  INSERT INTO customer_credits (customer_id, principal, interest_rate, term_months, start_date, status)
  SELECT c.id, 1500000, 12, 12, NOW(), 'active'
  FROM customers c
  LEFT JOIN customer_credits cc ON cc.customer_id = c.id
  WHERE cc.customer_id IS NULL
  LIMIT 2
  RETURNING id, principal, term_months
)
INSERT INTO credit_installments (credit_id, installment_number, due_date, amount, status)
SELECT nc.id, gs, NOW() + (gs * INTERVAL '30 days'), ROUND(nc.principal / nc.term_months, 2), 'pending'
FROM new_credits nc
CROSS JOIN generate_series(1, (SELECT term_months FROM new_credits WHERE id = nc.id)) AS gs;

WITH first_inst AS (
  SELECT i.id, i.credit_id, i.amount
  FROM credit_installments i
  JOIN customer_credits c ON c.id = i.credit_id
  ORDER BY c.created_at ASC, i.installment_number ASC
  LIMIT 1
)
INSERT INTO credit_payments (credit_id, installment_id, amount, payment_method)
SELECT fi.credit_id, fi.id, ROUND(fi.amount * 0.5, 2), 'cash'
FROM first_inst fi;

WITH second_inst AS (
  SELECT i.id, i.credit_id, i.amount
  FROM credit_installments i
  JOIN customer_credits c ON c.id = i.credit_id
  WHERE i.installment_number = 2
  ORDER BY c.created_at ASC, i.installment_number ASC
  LIMIT 1
)
INSERT INTO credit_payments (credit_id, installment_id, amount, payment_method)
SELECT si.credit_id, si.id, ROUND(si.amount, 2), 'card'
FROM second_inst si
WHERE NOT EXISTS (
  SELECT 1 FROM credit_payments cp
  WHERE cp.installment_id = si.id
    AND cp.amount = ROUND(si.amount, 2)
    AND cp.payment_method = 'card'
);

WITH other_first_inst AS (
  SELECT i.id, i.credit_id, i.amount
  FROM credit_installments i
  WHERE i.installment_number = 1
  ORDER BY i.created_at DESC
  LIMIT 1 OFFSET 1
)
INSERT INTO credit_payments (credit_id, installment_id, amount, payment_method)
SELECT oi.credit_id, oi.id, ROUND(oi.amount * 0.3, 2), 'transfer'
FROM other_first_inst oi
WHERE NOT EXISTS (
  SELECT 1 FROM credit_payments cp
  WHERE cp.installment_id = oi.id
    AND cp.payment_method = 'transfer'
);
