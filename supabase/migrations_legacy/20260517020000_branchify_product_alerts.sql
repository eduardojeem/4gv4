-- ============================================================================
-- Branch-aware product alerts
-- Fecha: 2026-05-17
-- Objetivo:
--   - persistir alertas de stock por sucursal
--   - mantener alertas globales solo para metadata del producto
--   - sincronizar alertas cuando cambia branch_inventory o el producto
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_alerts'
      AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_alerts'
      AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE public.product_alerts RENAME COLUMN type TO alert_type;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_alerts'
      AND column_name = 'read'
  ) THEN
    EXECUTE 'UPDATE public.product_alerts SET read = COALESCE(read, false) WHERE read IS NULL';
  END IF;
END;
$$;

ALTER TABLE public.product_alerts
  ADD COLUMN IF NOT EXISTS alert_type TEXT;

ALTER TABLE public.product_alerts
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_alerts_branch_id
  ON public.product_alerts(branch_id);

CREATE INDEX IF NOT EXISTS idx_product_alerts_branch_state
  ON public.product_alerts(branch_id, is_resolved, alert_type);

DROP TRIGGER IF EXISTS check_product_stock ON public.products;
DROP FUNCTION IF EXISTS public.check_low_stock();

CREATE OR REPLACE FUNCTION public.refresh_global_product_metadata_alerts(
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.product_alerts
  WHERE product_id = p_product_id
    AND branch_id IS NULL
    AND is_resolved = FALSE
    AND alert_type IN ('no_supplier', 'no_category', 'no_image');

  IF v_product.supplier_id IS NULL THEN
    INSERT INTO public.product_alerts (
      product_id,
      branch_id,
      alert_type,
      message,
      is_resolved
    )
    VALUES (
      p_product_id,
      NULL,
      'no_supplier',
      'Producto sin proveedor asignado',
      FALSE
    );
  END IF;

  IF v_product.category_id IS NULL THEN
    INSERT INTO public.product_alerts (
      product_id,
      branch_id,
      alert_type,
      message,
      is_resolved
    )
    VALUES (
      p_product_id,
      NULL,
      'no_category',
      'Producto sin categoría asignada',
      FALSE
    );
  END IF;

  IF v_product.images IS NULL OR COALESCE(array_length(v_product.images, 1), 0) = 0 THEN
    INSERT INTO public.product_alerts (
      product_id,
      branch_id,
      alert_type,
      message,
      is_resolved
    )
    VALUES (
      p_product_id,
      NULL,
      'no_image',
      'Producto sin imagen',
      FALSE
    );
  END IF;
END;
$$;

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
  v_branch_name TEXT;
  v_default_branch_id UUID;
BEGIN
  IF p_product_id IS NULL OR p_branch_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT name
  INTO v_branch_name
  FROM public.branches
  WHERE id = p_branch_id;

  IF v_branch_name IS NULL THEN
    RETURN;
  END IF;

  v_default_branch_id := public.get_default_branch_id();

  SELECT bi.stock_quantity
  INTO v_branch_stock
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

  DELETE FROM public.product_alerts
  WHERE product_id = p_product_id
    AND branch_id = p_branch_id
    AND is_resolved = FALSE
    AND alert_type IN ('low_stock', 'out_of_stock');

  IF v_branch_stock = 0 THEN
    INSERT INTO public.product_alerts (
      product_id,
      branch_id,
      alert_type,
      message,
      is_resolved
    )
    VALUES (
      p_product_id,
      p_branch_id,
      'out_of_stock',
      format('Producto agotado en %s', v_branch_name),
      FALSE
    );
  ELSIF v_branch_stock <= COALESCE(v_product.min_stock, 0) THEN
    INSERT INTO public.product_alerts (
      product_id,
      branch_id,
      alert_type,
      message,
      is_resolved
    )
    VALUES (
      p_product_id,
      p_branch_id,
      'low_stock',
      format('Stock bajo en %s: %s unidades restantes', v_branch_name, v_branch_stock),
      FALSE
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_branch_product_alerts(
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.refresh_global_product_metadata_alerts(p_product_id);

  FOR v_branch_id IN
    SELECT DISTINCT branch_id
    FROM (
      SELECT bi.branch_id
      FROM public.branch_inventory bi
      WHERE bi.product_id = p_product_id
      UNION
      SELECT public.get_default_branch_id()
    ) branches_to_refresh
  LOOP
    PERFORM public.refresh_branch_product_alerts(p_product_id, v_branch_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_branch_inventory_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_branch_product_alerts(OLD.product_id, OLD.branch_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_branch_product_alerts(NEW.product_id, NEW.branch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_inventory_refresh_alerts ON public.branch_inventory;
CREATE TRIGGER trg_branch_inventory_refresh_alerts
  AFTER INSERT OR UPDATE OF stock_quantity OR DELETE ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_branch_inventory_alerts();

CREATE OR REPLACE FUNCTION public.archive_old_product_alerts(months_to_keep INT DEFAULT 6)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    moved_count INT;
BEGIN
    IF to_regclass('public.product_alerts_archive') IS NULL THEN
      RETURN;
    END IF;

    WITH moved AS (
        DELETE FROM public.product_alerts
        WHERE created_at < NOW() - (months_to_keep || ' months')::interval
        RETURNING id, product_id, alert_type, message, details, read, is_resolved, resolved_at, created_at
    )
    INSERT INTO public.product_alerts_archive (id, product_id, type, message, details, read, is_resolved, resolved_at, created_at)
    SELECT id, product_id, alert_type, message, details, read, is_resolved, resolved_at, created_at FROM moved;

    GET DIAGNOSTICS moved_count = ROW_COUNT;

    RAISE NOTICE 'Archived % product alerts older than % months.', moved_count, months_to_keep;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_product_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_all_branch_product_alerts(NEW.id);
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS product_alerts_branch_scope ON public.product_alerts;
CREATE POLICY product_alerts_branch_scope
  ON public.product_alerts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    branch_id IS NULL
    OR public.user_has_branch_access(branch_id)
  )
  WITH CHECK (
    branch_id IS NULL
    OR public.user_has_branch_access(branch_id)
  );

CREATE OR REPLACE FUNCTION public.rebuild_branch_product_alerts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  DELETE FROM public.product_alerts
  WHERE is_resolved = FALSE
    AND alert_type IN ('low_stock', 'out_of_stock', 'no_supplier', 'no_category', 'no_image');

  FOR v_product_id IN
    SELECT id
    FROM public.products
  LOOP
    PERFORM public.refresh_all_branch_product_alerts(v_product_id);
  END LOOP;
END;
$$;

COMMIT;
