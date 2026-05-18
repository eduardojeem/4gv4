-- ============================================================================
-- Reduce product metadata alert noise for service-like products
-- Fecha: 2026-05-17
-- Objetivo:
--   - no generar alertas globales de metadata para servicios/reparaciones
--   - mantener alertas operativas de stock separadas
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_service_like_product(
  p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_sku TEXT;
  v_unit_measure TEXT;
  v_category_name TEXT;
BEGIN
  SELECT
    p.name,
    p.sku,
    p.unit_measure,
    c.name
  INTO
    v_name,
    v_sku,
    v_unit_measure,
    v_category_name
  FROM public.products p
  LEFT JOIN public.categories c
    ON c.id = p.category_id
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN
    lower(COALESCE(v_unit_measure, '')) = 'servicio'
    OR COALESCE(v_sku, '') ~* '^(SRV|SERV|SER)[-_]'
    OR lower(COALESCE(v_category_name, '')) LIKE '%servicio%'
    OR lower(COALESCE(v_category_name, '')) LIKE '%mano de obra%'
    OR lower(COALESCE(v_name, '')) LIKE 'reparacion%'
    OR lower(COALESCE(v_name, '')) LIKE 'reparación%'
    OR lower(COALESCE(v_name, '')) LIKE 'servicio%'
    OR lower(COALESCE(v_name, '')) LIKE 'cambio%'
    OR lower(COALESCE(v_name, '')) LIKE 'limpieza%'
    OR lower(COALESCE(v_name, '')) LIKE 'baño%'
    OR lower(COALESCE(v_name, '')) LIKE 'bano%'
    OR lower(COALESCE(v_name, '')) LIKE 'software%'
    OR lower(COALESCE(v_name, '')) LIKE 'backup%'
    OR lower(COALESCE(v_name, '')) LIKE 'instalacion%'
    OR lower(COALESCE(v_name, '')) LIKE 'instalación%'
    OR lower(COALESCE(v_name, '')) LIKE 'diagnostico%'
    OR lower(COALESCE(v_name, '')) LIKE 'diagnóstico%'
    OR lower(COALESCE(v_name, '')) LIKE '%mano de obra%';
END;
$$;

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

  IF public.is_service_like_product(p_product_id) THEN
    RETURN;
  END IF;

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

COMMIT;
