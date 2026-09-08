-- ============================================================================
-- El movimiento de venta se recalcula, no se acumula
-- ============================================================================
--
-- `log_sale_item_stock_movement` (20260907120000) insertaba una fila por cada
-- INSERT en `sale_items`. Eso alcanzaba mientras cada linea se insertara una
-- sola vez.
--
-- `process_pos_sale_atomic_v5` (20260908010913) rompe ese supuesto: llama a v4
-- —que inserta las lineas— y despues BORRA y VUELVE A INSERTAR las lineas con
-- variante para completarles los datos de la variante. Con el trigger anterior
-- eso dejaba DOS movimientos por cada producto con variante, y ademas
-- discrepantes: el primero leia el stock antes del descuento y el segundo
-- despues.
--
-- Tampoco servia acumular la cantidad, porque no hay forma de distinguir «otra
-- linea del mismo producto en la misma venta» de «la misma linea reinsertada».
--
-- La solucion es no depender del numero de inserciones: el movimiento refleja
-- el total actual de `sale_items` para esa venta y ese producto, recalculado en
-- cada cambio. Con eso da igual cuantas veces se inserte, se borre o se
-- reinserte una linea; y una venta con dos variantes del mismo producto queda
-- con un solo movimiento por la suma, que es justo lo que descuenta v2.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.log_sale_item_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id        UUID;
  v_product_id     UUID;
  v_sale           RECORD;
  v_total          INTEGER;
  v_previous_stock INTEGER;
  v_movement_id    UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
    v_product_id := OLD.product_id;
  ELSE
    v_sale_id := NEW.sale_id;
    v_product_id := NEW.product_id;
  END IF;

  IF v_product_id IS NULL OR v_sale_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT s.id, s.organization_id, s.branch_id, s.code, s.created_by
  INTO v_sale
  FROM public.sales s
  WHERE s.id = v_sale_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- El total vigente de la venta para ese producto, sea cual sea el camino que
  -- lo dejo asi.
  SELECT COALESCE(SUM(item.quantity), 0)
  INTO v_total
  FROM public.sale_items item
  WHERE item.sale_id = v_sale_id
    AND item.product_id = v_product_id;

  SELECT movement.id, movement.previous_stock
  INTO v_movement_id, v_previous_stock
  FROM public.product_movements movement
  WHERE movement.reference_id = v_sale_id
    AND movement.reference_type = 'sale'
    AND movement.product_id = v_product_id
  ORDER BY movement.created_at ASC
  LIMIT 1;

  -- El producto salio de la venta: el movimiento tampoco tiene razon de existir.
  IF v_total <= 0 THEN
    IF v_movement_id IS NOT NULL THEN
      DELETE FROM public.product_movements WHERE id = v_movement_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_movement_id IS NOT NULL THEN
    -- `previous_stock` es el que se capturo la primera vez: es el stock real de
    -- antes de la venta. Recalcularlo ahora leeria el stock YA descontado.
    UPDATE public.product_movements
    SET quantity = v_total,
        new_stock = v_previous_stock - v_total
    WHERE id = v_movement_id;

    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Primera vez para este producto en esta venta: se captura el stock previo.
  SELECT bi.stock_quantity
  INTO v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = v_sale.branch_id
    AND bi.product_id = v_product_id;

  IF v_previous_stock IS NULL THEN
    SELECT p.stock_quantity INTO v_previous_stock
    FROM public.products p
    WHERE p.id = v_product_id;
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
    v_product_id,
    'sale',
    v_total,
    v_previous_stock,
    v_previous_stock - v_total,
    'Venta ' || COALESCE(v_sale.code, v_sale.id::TEXT),
    v_sale.id,
    'sale',
    v_sale.created_by,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ahora tambien tiene que correr al borrar y al cambiar la cantidad: v5 borra
-- las lineas con variante antes de reinsertarlas.
DROP TRIGGER IF EXISTS trg_sale_items_log_movement ON public.sale_items;
CREATE TRIGGER trg_sale_items_log_movement
  AFTER INSERT OR UPDATE OF quantity OR DELETE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sale_item_stock_movement();

COMMENT ON FUNCTION public.log_sale_item_stock_movement() IS
'Mantiene en product_movements un movimiento por venta y producto, con la cantidad total vigente en sale_items. Idempotente ante el borrado y reinsercion de lineas que hace process_pos_sale_atomic_v5.';

COMMIT;

NOTIFY pgrst, 'reload schema';
