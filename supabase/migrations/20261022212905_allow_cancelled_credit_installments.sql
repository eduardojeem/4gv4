-- `void_pos_sale` already cancels unpaid installments when it closes an
-- uncollected credit. Keep that transition aligned with the credit status
-- contract without rewriting the historical baseline migration.
BEGIN;

ALTER TABLE public.credit_installments
  DROP CONSTRAINT IF EXISTS credit_installments_status_check;

ALTER TABLE public.credit_installments
  ADD CONSTRAINT credit_installments_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'late'::text, 'cancelled'::text]));

-- Update branch_inventory once. Its triggers maintain products.stock_quantity;
-- writing both tables directly restores the same units twice on the default branch.
CREATE OR REPLACE FUNCTION public.void_pos_sale(
  p_sale_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sale public.sales%rowtype;
  item record;
  credit record;
  paid_installments integer := 0;
  cancelled_installments integer := 0;
  restored_units integer := 0;
  cash_total numeric := 0;
  open_session uuid;
  inventory_rows integer := 0;
  motivo text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  SELECT * INTO sale
  FROM public.sales
  WHERE id = p_sale_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_IN_ORGANIZATION';
  END IF;

  -- Anular dos veces no puede devolver el stock dos veces.
  IF sale.status = 'cancelled' THEN
    RETURN jsonb_build_object('sale_id', sale.id, 'already_voided', true);
  END IF;

  -- Si ya hubo pagos del crédito, se conserva la regla y su historial.
  FOR credit IN
    SELECT c.id
    FROM public.customer_credits c
    WHERE c.sale_id = p_sale_id AND c.organization_id = p_organization_id
  LOOP
    SELECT count(*) INTO paid_installments
    FROM public.credit_installments i
    WHERE i.credit_id = credit.id AND coalesce(i.amount_paid, 0) > 0;

    IF paid_installments > 0 THEN
      RAISE EXCEPTION 'SALE_CREDIT_ALREADY_PAID';
    END IF;
  END LOOP;

  -- ── Stock: se devuelve lo que la venta descontó ──
  FOR item IN
    SELECT si.product_id, si.variant_id, sum(si.quantity)::integer AS quantity
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id AND si.organization_id = p_organization_id
    GROUP BY si.product_id, si.variant_id
  LOOP
    IF item.variant_id IS NOT NULL THEN
      PERFORM public.adjust_variant_stock_atomic(
        p_organization_id, sale.branch_id, item.variant_id, item.quantity,
        'return', 'void-sale:' || p_sale_id::text || ':' || item.variant_id::text,
        p_actor_id, 'sale', p_sale_id, 'Anulación de venta',
        jsonb_build_object('sale_id', p_sale_id, 'voided', true)
      );
    ELSE
      UPDATE public.branch_inventory
      SET stock_quantity = stock_quantity + item.quantity, updated_at = now()
      WHERE branch_id = sale.branch_id AND product_id = item.product_id;
      GET DIAGNOSTICS inventory_rows = ROW_COUNT;

      -- Legacy products without a branch row still retain their aggregate stock.
      IF inventory_rows = 0 THEN
        UPDATE public.products
        SET stock_quantity = stock_quantity + item.quantity, updated_at = now()
        WHERE id = item.product_id AND organization_id = p_organization_id;
      END IF;
    END IF;

    restored_units := restored_units + item.quantity;
  END LOOP;

  -- ── Crédito: cuotas impagas canceladas y crédito cerrado ──
  FOR credit IN
    SELECT c.id
    FROM public.customer_credits c
    WHERE c.sale_id = p_sale_id AND c.organization_id = p_organization_id
  LOOP
    UPDATE public.credit_installments
    SET status = 'cancelled', updated_at = now()
    WHERE credit_id = credit.id AND status <> 'paid';
    GET DIAGNOSTICS cancelled_installments = ROW_COUNT;

    UPDATE public.customer_credits
    SET status = 'cancelled',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'voided_with_sale', p_sale_id, 'voided_at', now(), 'voided_by', p_actor_id)
    WHERE id = credit.id;
  END LOOP;

  -- ── Caja: se revierte solamente el efectivo ya cobrado ──
  SELECT coalesce(sum(sp.amount), 0) INTO cash_total
  FROM public.sale_payments sp
  WHERE sp.sale_id = p_sale_id
    AND sp.organization_id = p_organization_id
    AND lower(sp.payment_method) = 'cash';

  IF cash_total > 0 THEN
    SELECT cc.id INTO open_session
    FROM public.cash_closures cc
    WHERE cc.organization_id = p_organization_id
      AND cc.branch_id = sale.branch_id
      AND cc.date IS NULL
    ORDER BY cc.created_at DESC
    LIMIT 1;

    IF open_session IS NULL THEN
      RAISE EXCEPTION 'VOID_REQUIRES_OPEN_REGISTER';
    END IF;

    INSERT INTO public.cash_movements (
      session_id, type, amount, reason, payment_method, created_by, created_at,
      organization_id, branch_id
    ) VALUES (
      open_session, 'cash_out', cash_total,
      'Anulación de venta ' || coalesce(sale.code, p_sale_id::text)
        || CASE WHEN motivo IS NULL THEN '' ELSE ' — ' || motivo END,
      'cash', p_actor_id, now(), p_organization_id, sale.branch_id
    );
  END IF;

  UPDATE public.sales
  SET status = 'cancelled',
      payment_status = 'cancelled',
      notes = trim(both E'\n' from coalesce(notes, '') || E'\n[ANULADA ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']'
        || CASE WHEN motivo IS NULL THEN '' ELSE ' ' || motivo END),
      updated_at = now()
  WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'sale_id', sale.id,
    'already_voided', false,
    'restored_units', restored_units,
    'cancelled_installments', cancelled_installments,
    'cash_returned', cash_total
  );
END
$function$;

COMMIT;
