-- ============================================================================
-- Umbrales por sucursal y un stock global que vuelve a significar algo
-- ============================================================================
--
-- 1. `branch_inventory` solo guardaba `stock_quantity` y `reserved_quantity`.
--    Con una sucursal activa se comparaba el stock DE ESA SUCURSAL contra el
--    `min_stock` GLOBAL del producto: un minimo de 50 pensado para el deposito
--    central dejaba al kiosco en «Stock bajo» permanente, y las alertas que
--    genera el trigger heredaban el mismo criterio.
--
-- 2. `products.stock_quantity` habia dejado de significar nada. La venta del
--    POS descuenta las dos tablas, pero `PUT /api/products/[id]` con sucursal
--    activa escribe solo `branch_inventory`: la columna global solo baja y
--    nunca sube, hasta llegar a cero y quedarse ahi. Y es la columna que leen
--    /dashboard/products, la vitrina publica y el informe de inventario sin
--    sucursal seleccionada.
--
--    Se define como «la suma de lo que hay en las sucursales» y se mantiene
--    sola. La alternativa —dejar de leerla— tocaba media aplicacion; esta hace
--    que las pantallas que ya la leen digan la verdad.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Minimo y maximo por sucursal
-- ----------------------------------------------------------------------------
--
-- NULL significa «usar el del producto». Asi una instalacion que nunca los
-- configure se comporta exactamente como hoy, y quien los configure obtiene
-- umbrales propios sin migrar nada.

ALTER TABLE public.branch_inventory
  ADD COLUMN IF NOT EXISTS min_stock INTEGER,
  ADD COLUMN IF NOT EXISTS max_stock INTEGER;

COMMENT ON COLUMN public.branch_inventory.min_stock IS
'Minimo de esta sucursal. NULL usa products.min_stock: el deposito central y el kiosco no necesitan el mismo umbral.';

COMMENT ON COLUMN public.branch_inventory.max_stock IS
'Maximo de esta sucursal. NULL usa products.max_stock, y 0 o NULL significan «sin maximo definido».';

-- Las alertas usan el umbral de la sucursal cuando existe.
CREATE OR REPLACE FUNCTION public.refresh_branch_product_alerts(
  p_product_id UUID,
  p_branch_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_branch_stock INTEGER;
  v_branch_min INTEGER;
  v_branch_name TEXT;
  v_default_branch_id UUID;
BEGIN
  IF p_product_id IS NULL OR p_branch_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT name INTO v_branch_name FROM public.branches WHERE id = p_branch_id;
  IF v_branch_name IS NULL THEN
    RETURN;
  END IF;

  v_default_branch_id := public.get_default_branch_id();

  SELECT bi.stock_quantity, bi.min_stock
  INTO v_branch_stock, v_branch_min
  FROM public.branch_inventory bi
  WHERE bi.product_id = p_product_id
    AND bi.branch_id = p_branch_id;

  v_branch_stock := COALESCE(
    v_branch_stock,
    CASE
      WHEN p_branch_id = v_default_branch_id THEN COALESCE(v_product.stock_quantity, 0)
      ELSE 0
    END
  );

  -- El umbral de la sucursal manda; sin el, el del producto.
  v_branch_min := COALESCE(v_branch_min, v_product.min_stock, 0);

  DELETE FROM public.product_alerts
  WHERE product_id = p_product_id
    AND branch_id = p_branch_id
    AND is_resolved = FALSE
    AND alert_type IN ('low_stock', 'out_of_stock');

  IF v_branch_stock = 0 THEN
    INSERT INTO public.product_alerts (product_id, branch_id, alert_type, message, is_resolved)
    VALUES (
      p_product_id, p_branch_id, 'out_of_stock',
      format('Producto agotado en %s', v_branch_name), FALSE
    );
  ELSIF v_branch_stock <= v_branch_min THEN
    INSERT INTO public.product_alerts (product_id, branch_id, alert_type, message, is_resolved)
    VALUES (
      p_product_id, p_branch_id, 'low_stock',
      format('Stock bajo en %s: %s unidades restantes (mínimo %s)', v_branch_name, v_branch_stock, v_branch_min),
      FALSE
    );
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. `products.stock_quantity` = suma de las sucursales
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_product_total_stock(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_rows INTEGER;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(stock_quantity), 0), COUNT(*)
  INTO v_total, v_rows
  FROM public.branch_inventory
  WHERE product_id = p_product_id;

  -- Sin ninguna fila por sucursal, la columna global es el unico dato que hay:
  -- ponerla en cero borraria el stock de una instalacion de una sola sucursal
  -- que nunca inicializo `branch_inventory`.
  IF v_rows = 0 THEN
    RETURN;
  END IF;

  UPDATE public.products
  SET stock_quantity = v_total,
      updated_at = NOW()
  WHERE id = p_product_id
    AND stock_quantity IS DISTINCT FROM v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_total_stock_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_product_total_stock(OLD.product_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_product_total_stock(NEW.product_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_inventory_sync_total ON public.branch_inventory;
CREATE TRIGGER trg_branch_inventory_sync_total
  AFTER INSERT OR UPDATE OF stock_quantity OR DELETE ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_total_stock_trigger();

-- Puesta al dia de lo que ya se desincronizo.
UPDATE public.products product
SET stock_quantity = totales.total,
    updated_at = NOW()
FROM (
  SELECT product_id, COALESCE(SUM(stock_quantity), 0)::INTEGER AS total
  FROM public.branch_inventory
  GROUP BY product_id
) totales
WHERE product.id = totales.product_id
  AND product.stock_quantity IS DISTINCT FROM totales.total;

COMMENT ON COLUMN public.products.stock_quantity IS
'Suma del stock de todas las sucursales, mantenida por trg_branch_inventory_sync_total. No se escribe a mano cuando hay inventario por sucursal.';

COMMIT;

NOTIFY pgrst, 'reload schema';
