-- Function to process POS sales atomically
-- Handles sale creation, items insertion, and stock updates

CREATE OR REPLACE FUNCTION process_pos_sale(
  p_sale_data JSONB,
  p_items JSONB,
  p_payments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  -- 1. Insertar venta
  INSERT INTO sales (
    customer_id,
    total_amount,
    payment_method,
    status,
    notes,
    created_at
  ) VALUES (
    (p_sale_data->>'customer_id')::UUID,
    (p_sale_data->>'total_amount')::DECIMAL,
    p_sale_data->>'payment_method',
    COALESCE(p_sale_data->>'status', 'completed'),
    p_sale_data->>'notes',
    COALESCE((p_sale_data->>'created_at')::TIMESTAMPTZ, NOW())
  )
  RETURNING id INTO v_sale_id;

  -- 2. Insertar items y actualizar stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Insertar item
    INSERT INTO sale_items (
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
    UPDATE products
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
