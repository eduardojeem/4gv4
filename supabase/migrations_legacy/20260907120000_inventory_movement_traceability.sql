-- ============================================================================
-- Trazabilidad de stock: que todo movimiento quede registrado y se pueda leer
-- ============================================================================
--
-- Tres fallas encadenadas hacían que la pestaña «Movimientos» de
-- /admin/inventory se viera vacía aunque el stock se moviera todos los días:
--
--   1. La venta del POS (process_pos_sale_atomic_v2) descuenta `products` y
--      `branch_inventory` y no escribe NADA en `product_movements`. Toda la
--      salida real de mercadería era invisible, y la cadena
--      previous_stock -> new_stock de los ajustes no encadenaba.
--
--   2. `set_branch_inventory_stock` sí escribe la fila del ajuste, pero omite
--      `organization_id` (queda NULL, sin default) y `branch_id` (toma el
--      default de la columna: `get_default_branch_id()`, que no filtra por
--      empresa y devuelve la sucursal por defecto de CUALQUIER inquilino).
--
--   3. La política de lectura es
--      `has_org_permission(organization_id, ...)`. Con organization_id NULL eso
--      nunca es verdadero: la fila queda invisible para todos, para siempre.
--      La RPC es SECURITY DEFINER, así que el INSERT sí pasa. Se escribía y no
--      se podía leer.
--
-- Se arregla en tres capas, de la más específica a la más general, para que
-- ningún escritor futuro pueda volver a producir una fila invisible.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Red de seguridad: ninguna fila entra sin empresa, ni con una sucursal
--    que pertenezca a otra empresa.
-- ----------------------------------------------------------------------------
--
-- Va como BEFORE INSERT y no como NOT NULL a propósito: un NOT NULL haría
-- fallar la venta entera si algún escritor viejo omite la columna. Acá se
-- completa desde el producto, que es la fuente confiable.

CREATE OR REPLACE FUNCTION public.fill_product_movement_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_org UUID;
  v_branch_org  UUID;
BEGIN
  SELECT organization_id INTO v_product_org
  FROM public.products
  WHERE id = NEW.product_id;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_product_org;
  END IF;

  -- La sucursal por defecto de la columna puede ser de otra empresa
  -- (get_default_branch_id no filtra por organization_id). Si la sucursal no
  -- pertenece a la misma empresa que el producto, se reemplaza por la sucursal
  -- por defecto de esa empresa antes de que la fila quede escrita.
  IF NEW.branch_id IS NOT NULL AND v_product_org IS NOT NULL THEN
    SELECT organization_id INTO v_branch_org
    FROM public.branches
    WHERE id = NEW.branch_id;

    IF v_branch_org IS DISTINCT FROM v_product_org THEN
      NEW.branch_id := NULL;
    END IF;
  END IF;

  IF NEW.branch_id IS NULL AND v_product_org IS NOT NULL THEN
    SELECT id INTO NEW.branch_id
    FROM public.branches
    WHERE organization_id = v_product_org
    ORDER BY is_default DESC NULLS LAST, created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_movements_fill_scope ON public.product_movements;
CREATE TRIGGER trg_product_movements_fill_scope
  BEFORE INSERT ON public.product_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_product_movement_scope();

-- ----------------------------------------------------------------------------
-- 2. El ajuste por sucursal declara su empresa y su sucursal
-- ----------------------------------------------------------------------------
--
-- Además pasa a validar contra el stock esperado: la pantalla calculaba el
-- stock final en el navegador a partir de un valor leído al cargar la lista, y
-- mandaba ese absoluto. Una venta ocurrida mientras la pantalla estaba abierta
-- quedaba pisada sin aviso. Con p_expected_previous_stock la RPC rechaza el
-- ajuste si el stock cambió; sin ese parámetro se comporta como antes, para no
-- romper a quien todavía llame la versión vieja.

DROP FUNCTION IF EXISTS public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.set_branch_inventory_stock(
  p_product_id    UUID,
  p_branch_id     UUID,
  p_new_stock     INTEGER,
  p_movement_type TEXT DEFAULT 'adjustment',
  p_reason        TEXT DEFAULT NULL,
  p_reference_id  TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_expected_previous_stock INTEGER DEFAULT NULL
)
RETURNS TABLE (
  out_product_id     UUID,
  out_branch_id      UUID,
  out_previous_stock INTEGER,
  out_new_stock      INTEGER
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
  v_organization_id UUID;
BEGIN
  IF p_product_id IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'Producto y sucursal son obligatorios.';
  END IF;

  IF p_new_stock < 0 THEN
    RAISE EXCEPTION 'El stock no puede ser negativo.';
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

  SELECT organization_id INTO v_organization_id
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  -- La sucursal tiene que ser de la misma empresa que el producto.
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece a la empresa del producto.';
  END IF;

  -- Se bloquea la fila antes de leer el stock previo: dos cajas ajustando el
  -- mismo producto se serializan en vez de pisarse.
  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_branch_id
    AND bi.product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_previous_stock := 0;
  END IF;

  IF p_expected_previous_stock IS NOT NULL
     AND p_expected_previous_stock <> v_previous_stock THEN
    RAISE EXCEPTION 'STOCK_CHANGED|%|%', p_expected_previous_stock, v_previous_stock;
  END IF;

  INSERT INTO public.branch_inventory (
    branch_id, product_id, stock_quantity, reserved_quantity
  )
  VALUES (p_branch_id, p_product_id, p_new_stock, 0)
  ON CONFLICT (branch_id, product_id)
  DO UPDATE
    SET stock_quantity = EXCLUDED.stock_quantity,
        updated_at     = NOW();

  BEGIN
    v_ref_uuid := p_reference_id::UUID;
  EXCEPTION WHEN others THEN
    v_ref_uuid := NULL;
  END;

  -- organization_id y branch_id explícitos: sin ellos la fila se escribía pero
  -- la política de lectura la ocultaba para siempre.
  INSERT INTO public.product_movements (
    organization_id,
    branch_id,
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
    v_organization_id,
    p_branch_id,
    p_product_id,
    p_movement_type,
    ABS(p_new_stock - v_previous_stock),
    v_previous_stock,
    p_new_stock,
    p_reason,
    v_ref_uuid,
    p_reference_type,
    v_uid,
    NOW()
  );

  RETURN QUERY
  SELECT
    p_product_id     AS out_product_id,
    p_branch_id      AS out_branch_id,
    v_previous_stock AS out_previous_stock,
    p_new_stock      AS out_new_stock;
END;
$$;

REVOKE ALL ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_branch_inventory_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. La venta deja movimiento
-- ----------------------------------------------------------------------------
--
-- Va como trigger sobre `sale_items` y no dentro de la RPC de venta a
-- propósito: así queda cubierto TODO camino que registre una venta —
-- process_pos_sale_atomic_v2/v3/v4, POST /api/sales, y cualquier sincronización
-- posterior— con un solo lugar que mantener.
--
-- El orden importa y es el que corresponde: v2 inserta los items (línea 306) y
-- recién después descuenta el stock (línea 349). El trigger corre en el medio,
-- así que lee el stock ANTES del descuento: eso es exactamente previous_stock.

CREATE OR REPLACE FUNCTION public.log_sale_item_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale           RECORD;
  v_previous_stock INTEGER;
  v_quantity       INTEGER := COALESCE(NEW.quantity, 0);
BEGIN
  IF NEW.product_id IS NULL OR v_quantity = 0 THEN
    RETURN NEW;
  END IF;

  SELECT s.id, s.organization_id, s.branch_id, s.code, s.created_by
  INTO v_sale
  FROM public.sales s
  WHERE s.id = NEW.sale_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- El stock de la sucursal de la venta es el que se va a descontar. Si el
  -- producto todavía no tiene fila en esa sucursal se cae al stock global, que
  -- es lo que descuenta el camino sin sucursal.
  SELECT bi.stock_quantity
  INTO v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = v_sale.branch_id
    AND bi.product_id = NEW.product_id;

  IF v_previous_stock IS NULL THEN
    SELECT p.stock_quantity INTO v_previous_stock
    FROM public.products p
    WHERE p.id = NEW.product_id;
  END IF;

  v_previous_stock := COALESCE(v_previous_stock, 0);

  INSERT INTO public.product_movements (
    organization_id,
    branch_id,
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
    v_sale.organization_id,
    v_sale.branch_id,
    NEW.product_id,
    'sale',
    v_quantity,
    v_previous_stock,
    v_previous_stock - v_quantity,
    'Venta ' || COALESCE(v_sale.code, v_sale.id::TEXT),
    v_sale.id,
    'sale',
    v_sale.created_by,
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_items_log_movement ON public.sale_items;
CREATE TRIGGER trg_sale_items_log_movement
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sale_item_stock_movement();

-- ----------------------------------------------------------------------------
-- 4. Rescate de los movimientos que ya quedaron invisibles
-- ----------------------------------------------------------------------------
--
-- La empresa se recupera con certeza desde el producto. La sucursal real no se
-- puede reconstruir —esa información nunca se guardó—, así que sólo se corrige
-- la que apunta a otra empresa, que es directamente errónea.

UPDATE public.product_movements movement
SET organization_id = product.organization_id
FROM public.products product
WHERE movement.product_id = product.id
  AND movement.organization_id IS NULL
  AND product.organization_id IS NOT NULL;

UPDATE public.product_movements movement
SET branch_id = (
  SELECT branch.id
  FROM public.branches branch
  WHERE branch.organization_id = movement.organization_id
  ORDER BY branch.is_default DESC NULLS LAST, branch.created_at ASC
  LIMIT 1
)
WHERE movement.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.branches branch
    WHERE branch.id = movement.branch_id
      AND branch.organization_id = movement.organization_id
  );

COMMENT ON FUNCTION public.log_sale_item_stock_movement() IS
'Registra en product_movements la salida de stock de cada línea de venta. Corre AFTER INSERT sobre sale_items, antes del descuento, para capturar el stock previo real.';

COMMENT ON FUNCTION public.fill_product_movement_scope() IS
'Completa organization_id y corrige branch_id en product_movements. Sin organization_id la política de lectura oculta la fila para siempre.';

COMMIT;

NOTIFY pgrst, 'reload schema';
