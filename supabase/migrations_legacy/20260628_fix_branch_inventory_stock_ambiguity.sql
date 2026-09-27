-- ============================================================
-- FIX COMPLETO: set_branch_inventory_stock
-- Problemas resueltos:
--   1. Inserta en columna 'notes' (no 'reason' que no existe)
--   2. No inserta 'branch_id' en product_movements (columna opcional según versión)
--   3. Renombra columnas de RETURN para evitar ambigüedad con #variable_conflict
--   4. DROP previo para permitir cambio de tipo de retorno
-- ============================================================

DROP FUNCTION IF EXISTS public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.set_branch_inventory_stock(
  p_product_id    UUID,
  p_branch_id     UUID,
  p_new_stock     INTEGER,
  p_movement_type TEXT DEFAULT 'adjustment',
  p_reason        TEXT DEFAULT NULL,
  p_reference_id  TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  out_product_id    UUID,
  out_branch_id     UUID,
  out_previous_stock INTEGER,
  out_new_stock     INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_previous_stock INTEGER := 0;
  v_role           TEXT;
  v_ref_uuid       UUID;
BEGIN
  -- Validaciones de parámetros
  IF p_product_id IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'Producto y sucursal son obligatorios.';
  END IF;

  IF p_new_stock < 0 THEN
    RAISE EXCEPTION 'El stock no puede ser negativo.';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  -- Verificar permisos del usuario
  v_role := public.get_user_role(v_uid);
  IF NOT public.has_permission('inventory.manage', v_uid)
     AND v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permisos insuficientes para ajustar inventario.';
  END IF;

  -- Verificar acceso a la sucursal
  IF NOT public.user_has_branch_access(p_branch_id, v_uid) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre la sucursal seleccionada.';
  END IF;

  -- Verificar que el producto existe
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  -- Obtener stock previo desde branch_inventory
  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_branch_id
    AND bi.product_id = p_product_id;

  -- Upsert del stock en branch_inventory
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
        updated_at     = NOW();

  -- Intentar convertir reference_id a UUID
  BEGIN
    v_ref_uuid := p_reference_id::UUID;
  EXCEPTION WHEN others THEN
    v_ref_uuid := NULL;
  END;

  -- Registrar movimiento en product_movements usando columnas REALES
  -- (la tabla usa 'notes', no 'reason'; y no tiene branch_id obligatorio)
  INSERT INTO public.product_movements (
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    notes,
    reference_id,
    reference_type,
    user_id,
    created_at
  )
  VALUES (
    p_product_id,
    p_movement_type,
    ABS(p_new_stock - v_previous_stock),
    v_previous_stock,
    p_new_stock,
    p_reason,         -- guardado en columna 'notes'
    v_ref_uuid,
    p_reference_type,
    v_uid,
    NOW()
  );

  -- Retornar con nombres sin ambigüedad
  RETURN QUERY
  SELECT
    p_product_id     AS out_product_id,
    p_branch_id      AS out_branch_id,
    v_previous_stock AS out_previous_stock,
    p_new_stock      AS out_new_stock;
END;
$$;

-- Revocar de PUBLIC y otorgar a roles correctos
REVOKE ALL ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;
