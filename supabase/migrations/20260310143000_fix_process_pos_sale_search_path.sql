-- ============================================================================
-- Fix process_pos_sale search_path to be immutable (security best practice)
-- Fecha: 2026-03-10
-- ============================================================================

-- Recreate the function with explicit search_path
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_sale_data JSONB,
  p_items JSONB,
  p_payments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  -- Add variables for explicit casting if needed
  v_customer_id UUID;
  v_total_amount DECIMAL;
  v_payment_method TEXT;
  v_status TEXT;
  v_notes TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Extract values to variables for cleaner SQL
  v_customer_id := (p_sale_data->>'customer_id')::UUID;
  v_total_amount := (p_sale_data->>'total_amount')::DECIMAL;
  v_payment_method := p_sale_data->>'payment_method';
  v_status := COALESCE(p_sale_data->>'status', 'completed');
  v_notes := p_sale_data->>'notes';
  v_created_at := COALESCE((p_sale_data->>'created_at')::TIMESTAMPTZ, NOW());

  -- 1. Insertar venta
  INSERT INTO public.sales (
    customer_id,
    total_amount,
    payment_method,
    status,
    notes,
    created_at
  ) VALUES (
    v_customer_id,
    v_total_amount,
    v_payment_method,
    v_status,
    v_notes,
    v_created_at
  )
  RETURNING id INTO v_sale_id;

  -- 2. Insertar items y actualizar stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Insertar item
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'subtotal')::DECIMAL
    );

    -- Actualizar stock
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product_id;
    
  END LOOP;

  -- 3. Retornar resultado
  RETURN jsonb_build_object(
    'id', v_sale_id,
    'success', true
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error processing sale: %', SQLERRM;
END;
$$;
