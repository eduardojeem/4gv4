-- Synthetic local-only regression coverage for void_pos_sale. All data rolls back.
BEGIN;

DO $test$
DECLARE
  o uuid := 'e9220000-0000-4000-8000-000000000001';
  b uuid := 'e9220000-0000-4000-8000-000000000002';
  c uuid := 'e9220000-0000-4000-8000-000000000003';
  p uuid := 'e9220000-0000-4000-8000-000000000004';
  actor uuid := 'e9220000-0000-4000-8000-000000000005';
  cash_session uuid := 'e9220000-0000-4000-8000-000000000006';
  pure_sale uuid := 'e9220000-0000-4000-8000-000000000011';
  pure_credit uuid := 'e9220000-0000-4000-8000-000000000012';
  pure_installment uuid := 'e9220000-0000-4000-8000-000000000013';
  partial_sale uuid := 'e9220000-0000-4000-8000-000000000021';
  partial_credit uuid := 'e9220000-0000-4000-8000-000000000022';
  partial_installment uuid := 'e9220000-0000-4000-8000-000000000023';
  mixed_sale uuid := 'e9220000-0000-4000-8000-000000000031';
  mixed_credit uuid := 'e9220000-0000-4000-8000-000000000032';
  mixed_installment uuid := 'e9220000-0000-4000-8000-000000000033';
  result jsonb;
  failure text;
  stock numeric;
  balance numeric;
BEGIN
  INSERT INTO auth.users(id, aud, role, email, created_at, updated_at)
  VALUES (actor, 'authenticated', 'authenticated', 'p1-credit-void@example.invalid', now(), now());
  INSERT INTO public.profiles(id) VALUES (actor);
  INSERT INTO public.organizations(id, name, slug) VALUES (o, 'Synthetic credit void fixture', 'p1-credit-void-fixture');
  INSERT INTO public.branches(id, organization_id, code, name, slug, is_default)
  VALUES (b, o, 'P1VOID', 'Synthetic branch', 'p1-credit-void-branch', true);
  INSERT INTO public.customers(id, organization_id, name, status) VALUES (c, o, 'Synthetic customer', 'activo');
  INSERT INTO public.products(id, organization_id, sku, name, sale_price, stock_quantity)
  VALUES (p, o, 'P1VOID-SKU', 'Synthetic item', 50, 0);
  UPDATE public.branch_inventory SET stock_quantity = 10 WHERE branch_id = b AND product_id = p;
  INSERT INTO public.cash_closures(id, organization_id, branch_id, type, register_id, date, status)
  VALUES (cash_session, o, b, 'cash', 'P1VOID-REGISTER', NULL, 'abierta');

  INSERT INTO public.sales(id, code, organization_id, branch_id, customer_id, total_amount, subtotal_amount, payment_method, status, payment_status)
  VALUES
    (pure_sale, 'P1VOID-PURE', o, b, c, 100, 100, 'credit', 'completed', 'pending'),
    (partial_sale, 'P1VOID-PARTIAL', o, b, c, 100, 100, 'credit', 'completed', 'pending'),
    (mixed_sale, 'P1VOID-MIXED', o, b, c, 100, 100, 'mixed', 'completed', 'pending');
  INSERT INTO public.sale_items(sale_id, product_id, organization_id, quantity, unit_price, subtotal)
  VALUES (pure_sale, p, o, 2, 50, 100), (partial_sale, p, o, 2, 50, 100), (mixed_sale, p, o, 2, 50, 100);
  INSERT INTO public.customer_credits(id, customer_id, sale_id, principal, term_months, status, organization_id, branch_id)
  VALUES
    (pure_credit, c, pure_sale, 100, 1, 'active', o, b),
    (partial_credit, c, partial_sale, 100, 1, 'active', o, b),
    (mixed_credit, c, mixed_sale, 100, 1, 'active', o, b);
  INSERT INTO public.credit_installments(id, credit_id, installment_number, due_date, amount, status, amount_paid, sale_id)
  VALUES
    (pure_installment, pure_credit, 1, current_date + 30, 100, 'pending', 0, pure_sale),
    (partial_installment, partial_credit, 1, current_date + 30, 100, 'pending', 25, partial_sale),
    (mixed_installment, mixed_credit, 1, current_date + 30, 100, 'pending', 0, mixed_sale);
  INSERT INTO public.sale_payments(organization_id, sale_id, payment_index, payment_method, amount, created_by, branch_id)
  VALUES (o, mixed_sale, 0, 'cash', 30, actor, b);

  -- Pure credit: close the sale and credit, cancel unpaid installments, restore stock.
  result := public.void_pos_sale(pure_sale, o, actor, 'synthetic regression test');
  ASSERT result->>'already_voided' = 'false' AND (result->>'restored_units')::integer = 2, 'pure-credit void returns expected result';
  ASSERT (SELECT status = 'cancelled' FROM public.sales WHERE id = pure_sale), 'pure-credit sale is cancelled';
  ASSERT (SELECT status = 'cancelled' FROM public.customer_credits WHERE id = pure_credit), 'pure-credit account is cancelled';
  ASSERT (SELECT status = 'cancelled' FROM public.credit_installments WHERE id = pure_installment), 'unpaid pure-credit installment is cancelled';
  ASSERT NOT EXISTS (SELECT 1 FROM public.cash_movements WHERE session_id = cash_session AND type = 'cash_out'), 'pure-credit void creates no cash movement';
  SELECT coalesce(sum(greatest(0, i.amount - coalesce(i.amount_paid, 0))), 0) INTO balance
  FROM public.credit_installments i JOIN public.customer_credits cr ON cr.id = i.credit_id
  WHERE cr.id = pure_credit AND cr.status NOT IN ('cancelled', 'cancelado', 'canceled');
  ASSERT balance = 0, 'voided credit no longer contributes collectible balance';
  SELECT stock_quantity INTO stock FROM public.branch_inventory WHERE branch_id = b AND product_id = p;
  ASSERT stock = 12, 'pure-credit void restores stock once';
  result := public.void_pos_sale(pure_sale, o, actor, 'synthetic idempotency test');
  SELECT stock_quantity INTO stock FROM public.branch_inventory WHERE branch_id = b AND product_id = p;
  ASSERT result->>'already_voided' = 'true' AND stock = 12, 'repeated pure-credit void does not restore stock twice';

  -- Any payment means the credit cannot be voided; no partial side effects are allowed.
  failure := NULL;
  BEGIN
    PERFORM public.void_pos_sale(partial_sale, o, actor, 'synthetic partial-payment test');
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS failure = MESSAGE_TEXT;
  END;
  ASSERT failure = 'SALE_CREDIT_ALREADY_PAID', 'partially paid credit is blocked';
  ASSERT (SELECT status = 'completed' FROM public.sales WHERE id = partial_sale), 'blocked sale remains completed';
  ASSERT (SELECT status = 'active' FROM public.customer_credits WHERE id = partial_credit), 'blocked credit remains active';
  ASSERT (SELECT status = 'pending' AND amount_paid = 25 FROM public.credit_installments WHERE id = partial_installment), 'blocked installment is unchanged';
  SELECT stock_quantity INTO stock FROM public.branch_inventory WHERE branch_id = b AND product_id = p;
  ASSERT stock = 12, 'blocked partial credit does not change stock';

  -- Failure after inventory/credit work has started must roll back the whole void.
  UPDATE public.cash_closures SET date = now() WHERE id = cash_session;
  failure := NULL;
  BEGIN
    PERFORM public.void_pos_sale(mixed_sale, o, actor, 'synthetic atomicity test');
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS failure = MESSAGE_TEXT;
  END;
  ASSERT failure = 'VOID_REQUIRES_OPEN_REGISTER', 'mixed void requires an open register';
  ASSERT (SELECT status = 'completed' FROM public.sales WHERE id = mixed_sale), 'failed mixed void leaves sale active';
  ASSERT (SELECT status = 'active' FROM public.customer_credits WHERE id = mixed_credit), 'failed mixed void leaves credit active';
  ASSERT (SELECT status = 'pending' FROM public.credit_installments WHERE id = mixed_installment), 'failed mixed void leaves installment active';
  SELECT stock_quantity INTO stock FROM public.branch_inventory WHERE branch_id = b AND product_id = p;
  ASSERT stock = 12, 'failed mixed void rolls back stock restoration';
  ASSERT NOT EXISTS (SELECT 1 FROM public.cash_movements WHERE session_id = cash_session AND type = 'cash_out'), 'failed mixed void does not write a cash movement';

  -- Mixed cash + credit: reverse only the cash component and cancel the unpaid credit.
  UPDATE public.cash_closures SET date = NULL WHERE id = cash_session;
  result := public.void_pos_sale(mixed_sale, o, actor, 'synthetic mixed-payment test');
  ASSERT (result->>'cash_returned')::numeric = 30, 'mixed void returns the cash component';
  ASSERT (SELECT status = 'cancelled' FROM public.credit_installments WHERE id = mixed_installment), 'mixed unpaid installment is cancelled';
  ASSERT (SELECT count(*) = 1 AND sum(amount) = 30 FROM public.cash_movements WHERE session_id = cash_session AND type = 'cash_out'), 'one matching cash reversal is recorded';
  ASSERT (SELECT count(*) = 1 FROM public.sale_payments WHERE sale_id = mixed_sale), 'mixed sale payment history is preserved';
  ASSERT (SELECT count(*) = 1 FROM public.sale_items WHERE sale_id = mixed_sale), 'sale item history is preserved';
  SELECT stock_quantity INTO stock FROM public.branch_inventory WHERE branch_id = b AND product_id = p;
  ASSERT stock = 14, 'mixed void restores its stock once';
  PERFORM public.void_pos_sale(mixed_sale, o, actor, 'synthetic mixed idempotency test');
  SELECT stock_quantity INTO stock FROM public.branch_inventory WHERE branch_id = b AND product_id = p;
  ASSERT stock = 14, 'repeated mixed void does not restore stock twice';
  ASSERT (SELECT count(*) = 1 FROM public.cash_movements WHERE session_id = cash_session AND type = 'cash_out'), 'repeated mixed void does not duplicate cash reversal';
END
$test$;

ROLLBACK;
