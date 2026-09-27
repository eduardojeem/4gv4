-- ============================================================================
-- Branch-aware stock adjustment RPC
-- Fecha: 2026-05-17
-- Objetivo:
--   - actualizar stock por sucursal en branch_inventory
--   - registrar movimiento en product_movements con branch_id
--   - mantener trazabilidad al migrar inventario a multi sucursal
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_branch_inventory_stock(
  p_product_id UUID,
  p_branch_id UUID,
  p_new_stock INTEGER,
  p_movement_type TEXT DEFAULT 'adjustment',
  p_reason TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  branch_id UUID,
  previous_stock INTEGER,
  new_stock INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous_stock INTEGER := 0;
  v_role TEXT;
BEGIN
  IF p_product_id IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'Producto y sucursal son obligatorios.';
  END IF;

  IF p_new_stock < 0 THEN
    RAISE EXCEPTION 'El stock no puede ser negativo.';
  END IF;

  IF p_movement_type NOT IN ('in', 'out', 'adjustment', 'transfer') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_movement_type;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  v_role := public.get_user_role(v_uid);
  IF NOT public.has_permission('inventory.manage', v_uid)
     AND v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permisos insuficientes para ajustar inventario.';
  END IF;

  IF NOT public.user_has_branch_access(p_branch_id, v_uid) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre la sucursal seleccionada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_branch_id
    AND bi.product_id = p_product_id;

  INSERT INTO public.branch_inventory (
    branch_id,
    product_id,
    stock_quantity,
    reserved_quantity
  )
  VALUES (
    p_branch_id,
    p_product_id,
    p_new_stock,
    0
  )
  ON CONFLICT (branch_id, product_id)
  DO UPDATE
  SET stock_quantity = EXCLUDED.stock_quantity,
      updated_at = NOW();

  INSERT INTO public.product_movements (
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reason,
    reference_id,
    reference_type,
    user_id,
    branch_id,
    created_at
  )
  VALUES (
    p_product_id,
    p_movement_type,
    ABS(p_new_stock - v_previous_stock),
    v_previous_stock,
    p_new_stock,
    p_reason,
    p_reference_id,
    p_reference_type,
    v_uid,
    p_branch_id,
    NOW()
  );

  RETURN QUERY
  SELECT
    p_product_id,
    p_branch_id,
    v_previous_stock,
    p_new_stock;
END;
$$;

REVOKE ALL ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;
