-- Fix transfer_branch_inventory_stock reference generation for databases where
-- uuid-ossp is not installed. Supabase includes pgcrypto/gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.transfer_branch_inventory_stock(
  p_product_id UUID,
  p_from_branch_id UUID,
  p_to_branch_id UUID,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  from_branch_id UUID,
  to_branch_id UUID,
  quantity INTEGER,
  from_previous_stock INTEGER,
  from_new_stock INTEGER,
  to_previous_stock INTEGER,
  to_new_stock INTEGER,
  transfer_reference_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_from_previous_stock INTEGER := 0;
  v_to_previous_stock INTEGER := 0;
  v_from_new_stock INTEGER := 0;
  v_to_new_stock INTEGER := 0;
  v_reference_id TEXT := COALESCE(NULLIF(p_reference_id, ''), gen_random_uuid()::TEXT);
  v_from_branch_name TEXT;
  v_to_branch_name TEXT;
  v_product_organization_id UUID;
  v_from_organization_id UUID;
  v_to_organization_id UUID;
BEGIN
  IF p_product_id IS NULL OR p_from_branch_id IS NULL OR p_to_branch_id IS NULL THEN
    RAISE EXCEPTION 'Producto, sucursal origen y sucursal destino son obligatorios.';
  END IF;

  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'La sucursal origen y destino deben ser diferentes.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad a transferir debe ser mayor a cero.';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  v_role := public.get_user_role(v_uid);
  IF NOT public.has_permission('inventory.manage', v_uid)
     AND NOT public.has_permission('inventory.stock.manage', v_uid)
     AND v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permisos insuficientes para transferir inventario.';
  END IF;

  IF NOT public.user_has_branch_access(p_from_branch_id, v_uid) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre la sucursal origen.';
  END IF;

  IF NOT public.user_has_branch_access(p_to_branch_id, v_uid) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre la sucursal destino.';
  END IF;

  SELECT p.organization_id
  INTO v_product_organization_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_product_organization_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  SELECT b.organization_id, b.name
  INTO v_from_organization_id, v_from_branch_name
  FROM public.branches b
  WHERE b.id = p_from_branch_id
    AND b.is_active = TRUE;

  IF v_from_organization_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal origen no encontrada o inactiva.';
  END IF;

  SELECT b.organization_id, b.name
  INTO v_to_organization_id, v_to_branch_name
  FROM public.branches b
  WHERE b.id = p_to_branch_id
    AND b.is_active = TRUE;

  IF v_to_organization_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal destino no encontrada o inactiva.';
  END IF;

  IF v_product_organization_id IS DISTINCT FROM v_from_organization_id
     OR v_product_organization_id IS DISTINCT FROM v_to_organization_id THEN
    RAISE EXCEPTION 'El producto y las sucursales deben pertenecer a la misma organizacion.';
  END IF;

  INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity, reserved_quantity)
  VALUES
    (p_from_branch_id, p_product_id, 0, 0),
    (p_to_branch_id, p_product_id, 0, 0)
  ON CONFLICT (branch_id, product_id) DO NOTHING;

  PERFORM 1
  FROM public.branch_inventory bi
  WHERE bi.product_id = p_product_id
    AND bi.branch_id IN (p_from_branch_id, p_to_branch_id)
  ORDER BY bi.branch_id
  FOR UPDATE;

  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_from_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_from_branch_id
    AND bi.product_id = p_product_id;

  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_to_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_to_branch_id
    AND bi.product_id = p_product_id;

  IF v_from_previous_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente en la sucursal origen. Disponible: %, solicitado: %.',
      v_from_previous_stock,
      p_quantity;
  END IF;

  v_from_new_stock := v_from_previous_stock - p_quantity;
  v_to_new_stock := v_to_previous_stock + p_quantity;

  UPDATE public.branch_inventory
  SET stock_quantity = v_from_new_stock,
      updated_at = NOW()
  WHERE branch_id = p_from_branch_id
    AND product_id = p_product_id;

  UPDATE public.branch_inventory
  SET stock_quantity = v_to_new_stock,
      updated_at = NOW()
  WHERE branch_id = p_to_branch_id
    AND product_id = p_product_id;

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
    branch_id,
    created_at
  )
  VALUES
    (
      p_product_id,
      'transfer',
      p_quantity,
      v_from_previous_stock,
      v_from_new_stock,
      COALESCE(NULLIF(p_reason, ''), 'Transferencia entre sucursales') || ' | Salida hacia: ' || COALESCE(v_to_branch_name, p_to_branch_id::TEXT),
      v_reference_id,
      'branch_transfer',
      v_uid,
      p_from_branch_id,
      NOW()
    ),
    (
      p_product_id,
      'transfer',
      p_quantity,
      v_to_previous_stock,
      v_to_new_stock,
      COALESCE(NULLIF(p_reason, ''), 'Transferencia entre sucursales') || ' | Entrada desde: ' || COALESCE(v_from_branch_name, p_from_branch_id::TEXT),
      v_reference_id,
      'branch_transfer',
      v_uid,
      p_to_branch_id,
      NOW()
    );

  RETURN QUERY
  SELECT
    p_product_id,
    p_from_branch_id,
    p_to_branch_id,
    p_quantity,
    v_from_previous_stock,
    v_from_new_stock,
    v_to_previous_stock,
    v_to_new_stock,
    v_reference_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_branch_inventory_stock(UUID, UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_branch_inventory_stock(UUID, UUID, UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_branch_inventory_stock(UUID, UUID, UUID, INTEGER, TEXT, TEXT) TO service_role;
