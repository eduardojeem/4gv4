-- ============================================================================
-- Harden customer credits module
-- - Prevent overpayments at DB level
-- - Clamp installment amount_paid to installment amount
-- - Align RLS write permissions with dashboard roles
-- Fecha: 2026-03-08
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Guardrail: normalize payment amount before insert
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'credit_payments'
  ) THEN
    ALTER TABLE public.credit_payments
      ADD COLUMN IF NOT EXISTS notes TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'credit_payments_amount_positive_chk'
    ) THEN
      ALTER TABLE public.credit_payments
        ADD CONSTRAINT credit_payments_amount_positive_chk
        CHECK (amount > 0);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_credit_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  installment_amount NUMERIC;
  installment_credit_id UUID;
  already_paid NUMERIC;
  outstanding NUMERIC;
BEGIN
  IF NEW.installment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.amount, i.credit_id
  INTO installment_amount, installment_credit_id
  FROM public.credit_installments i
  WHERE i.id = NEW.installment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment % not found', NEW.installment_id;
  END IF;

  IF NEW.credit_id IS NULL THEN
    NEW.credit_id := installment_credit_id;
  ELSIF NEW.credit_id <> installment_credit_id THEN
    RAISE EXCEPTION 'credit_id % does not match installment % credit_id %', NEW.credit_id, NEW.installment_id, installment_credit_id;
  END IF;

  IF COALESCE(NEW.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO already_paid
  FROM public.credit_payments p
  WHERE p.installment_id = NEW.installment_id;

  outstanding := GREATEST(installment_amount - already_paid, 0);

  IF outstanding <= 0 THEN
    RAISE EXCEPTION 'Installment % has no outstanding balance', NEW.installment_id;
  END IF;

  NEW.amount := LEAST(NEW.amount, outstanding);
  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'credit_payments'
  ) THEN
    DROP TRIGGER IF EXISTS tr_credit_payments_before_insert_normalize ON public.credit_payments;
    CREATE TRIGGER tr_credit_payments_before_insert_normalize
      BEFORE INSERT ON public.credit_payments
      FOR EACH ROW
      EXECUTE FUNCTION public.normalize_credit_payment_amount();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Recompute installment state with capped amount_paid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_installment_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst_id UUID;
  credit UUID;
  total NUMERIC;
  total_capped NUMERIC;
  inst_amount NUMERIC;
  inst_due TIMESTAMPTZ;
  new_status TEXT;
  payment_method_value TEXT;
BEGIN
  inst_id := COALESCE(NEW.installment_id, OLD.installment_id);
  IF inst_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT credit_id, amount, due_date
  INTO credit, inst_amount, inst_due
  FROM public.credit_installments
  WHERE id = inst_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO total
  FROM public.credit_payments
  WHERE installment_id = inst_id;

  total_capped := LEAST(total, inst_amount);

  payment_method_value := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.payment_method END;

  IF total_capped >= inst_amount THEN
    UPDATE public.credit_installments
    SET amount_paid = total_capped,
        status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        payment_method = COALESCE(payment_method_value, payment_method),
        updated_at = NOW()
    WHERE id = inst_id;
  ELSE
    new_status := CASE WHEN inst_due < NOW() THEN 'late' ELSE 'pending' END;
    UPDATE public.credit_installments
    SET amount_paid = total_capped,
        status = new_status,
        paid_at = NULL,
        payment_method = COALESCE(payment_method_value, payment_method),
        updated_at = NOW()
    WHERE id = inst_id;
  END IF;

  IF credit IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.credit_installments
      WHERE credit_id = credit
        AND status <> 'paid'
    ) THEN
      UPDATE public.customer_credits
      SET status = 'completed', updated_at = NOW()
      WHERE id = credit;
    ELSE
      UPDATE public.customer_credits
      SET status = 'active', updated_at = NOW()
      WHERE id = credit
        AND status = 'completed';
    END IF;
  END IF;

  RETURN NULL;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'credit_installments'
  ) THEN
    UPDATE public.credit_installments
    SET amount_paid = LEAST(COALESCE(amount_paid, 0), amount),
        status = CASE
          WHEN LEAST(COALESCE(amount_paid, 0), amount) >= amount THEN 'paid'
          WHEN due_date < NOW() THEN 'late'
          ELSE 'pending'
        END,
        paid_at = CASE
          WHEN LEAST(COALESCE(amount_paid, 0), amount) >= amount THEN COALESCE(paid_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
    WHERE amount_paid IS NOT NULL
      AND amount_paid > amount;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) RLS hardening for credits tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_profiles BOOLEAN;
  policy_record RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_credits'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'credit_installments'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'credit_payments'
  ) THEN
    RAISE NOTICE 'Skipping credits RLS hardening: one or more credits tables do not exist';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) INTO has_profiles;

  ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('customer_credits', 'credit_installments', 'credit_payments')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  END LOOP;

  CREATE POLICY customer_credits_select_authenticated
    ON public.customer_credits
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY credit_installments_select_authenticated
    ON public.credit_installments
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY credit_payments_select_authenticated
    ON public.credit_payments
    FOR SELECT
    TO authenticated
    USING (true);

  IF has_profiles THEN
    CREATE POLICY customer_credits_insert_staff
      ON public.customer_credits
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY customer_credits_update_staff
      ON public.customer_credits
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY customer_credits_delete_admin
      ON public.customer_credits
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
      );

    CREATE POLICY credit_installments_insert_staff
      ON public.credit_installments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY credit_installments_update_staff
      ON public.credit_installments
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY credit_installments_delete_admin
      ON public.credit_installments
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
      );

    CREATE POLICY credit_payments_insert_staff
      ON public.credit_payments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY credit_payments_update_staff
      ON public.credit_payments
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'vendedor')
        )
      );

    CREATE POLICY credit_payments_delete_admin
      ON public.credit_payments
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
      );
  ELSE
    CREATE POLICY customer_credits_insert_staff
      ON public.customer_credits
      FOR INSERT
      TO authenticated
      WITH CHECK (false);

    CREATE POLICY customer_credits_update_staff
      ON public.customer_credits
      FOR UPDATE
      TO authenticated
      USING (false)
      WITH CHECK (false);

    CREATE POLICY customer_credits_delete_admin
      ON public.customer_credits
      FOR DELETE
      TO authenticated
      USING (false);

    CREATE POLICY credit_installments_insert_staff
      ON public.credit_installments
      FOR INSERT
      TO authenticated
      WITH CHECK (false);

    CREATE POLICY credit_installments_update_staff
      ON public.credit_installments
      FOR UPDATE
      TO authenticated
      USING (false)
      WITH CHECK (false);

    CREATE POLICY credit_installments_delete_admin
      ON public.credit_installments
      FOR DELETE
      TO authenticated
      USING (false);

    CREATE POLICY credit_payments_insert_staff
      ON public.credit_payments
      FOR INSERT
      TO authenticated
      WITH CHECK (false);

    CREATE POLICY credit_payments_update_staff
      ON public.credit_payments
      FOR UPDATE
      TO authenticated
      USING (false)
      WITH CHECK (false);

    CREATE POLICY credit_payments_delete_admin
      ON public.credit_payments
      FOR DELETE
      TO authenticated
      USING (false);
  END IF;

  RAISE NOTICE 'Credits hardening applied. profiles table found: %', has_profiles;
END $$;
