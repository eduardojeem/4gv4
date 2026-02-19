CREATE OR REPLACE FUNCTION public.create_test_credit(
  p_customer_id UUID,
  p_principal NUMERIC,
  p_term_months INTEGER,
  p_paid_installments INTEGER DEFAULT 0
) RETURNS UUID 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
      CASE WHEN i <= p_paid_installments THEN v_installment_amount ELSE 0 END,
      NOW()
    );

    IF i <= p_paid_installments THEN
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
    END IF;
  END LOOP;

  RETURN v_credit_id;
END;
$$;
