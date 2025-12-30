-- =====================================================
-- CUSTOMER CREDITS MODULE
-- =====================================================

-- Tables: customer_credits, credit_installments, credit_payments

CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID NOT NULL,
  sale_id UUID,
  principal NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  term_months INTEGER NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('active','completed','defaulted','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_installments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES customer_credits(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC NOT NULL,
  principal_component NUMERIC NOT NULL DEFAULT 0,
  interest_component NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending','paid','late')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IN ('cash','card','transfer')),
  amount_paid NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES customer_credits(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES credit_installments(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','card','transfer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

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
        payment_method = COALESCE(NEW.payment_method, payment_method),
        updated_at = NOW()
    WHERE id = inst_id;
  ELSE
    new_status := CASE WHEN inst_due < NOW() THEN 'late' ELSE 'pending' END;
    UPDATE credit_installments
    SET amount_paid = total,
        status = new_status,
        paid_at = NULL,
        payment_method = COALESCE(NEW.payment_method, payment_method),
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

-- Additional index for faster aggregation by installment
CREATE INDEX IF NOT EXISTS idx_payments_installment_id ON credit_payments(installment_id);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_installments_credit_id ON credit_installments(credit_id);
CREATE INDEX IF NOT EXISTS idx_payments_credit_id ON credit_payments(credit_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_customer_credits_customer'
      AND conrelid = 'customer_credits'::regclass
  ) THEN
    ALTER TABLE customer_credits
      ADD CONSTRAINT fk_customer_credits_customer
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW credit_details AS
SELECT 
  cc.*,
  c.name AS customer_name
FROM customer_credits cc
JOIN customers c ON c.id = cc.customer_id;
GRANT SELECT ON credit_details TO authenticated;

-- Ensure get_user_role() exists for RLS policies
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

-- RLS
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- Policies (basic read for authenticated, write for admins)
DROP POLICY IF EXISTS "Read credits" ON customer_credits;
CREATE POLICY "Read credits" ON customer_credits FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Read installments" ON credit_installments;
CREATE POLICY "Read installments" ON credit_installments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Read payments" ON credit_payments;
CREATE POLICY "Read payments" ON credit_payments FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write credits for admins" ON customer_credits;
CREATE POLICY "Write credits for admins" ON customer_credits FOR ALL USING (public.get_user_role() IN ('admin','super_admin'));
DROP POLICY IF EXISTS "Write installments for admins" ON credit_installments;
CREATE POLICY "Write installments for admins" ON credit_installments FOR ALL USING (public.get_user_role() IN ('admin','super_admin'));
DROP POLICY IF EXISTS "Write payments for admins" ON credit_payments;
CREATE POLICY "Write payments for admins" ON credit_payments FOR ALL USING (public.get_user_role() IN ('admin','super_admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'customer_credits'
      AND pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_credits;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'credit_installments'
      AND pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_installments;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'credit_payments'
      AND pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_payments;
  END IF;
END $$;
