-- Visibilidad del costo (purchase_price) solo para admin / super_admin.
--
-- El dashboard lee la tabla products directo desde el navegador, así que el
-- enmascaramiento debe vivir en la base. Estrategia:
--   1) Función app_can_view_cost(): true solo si el usuario actual es
--      admin/super_admin (SECURITY DEFINER para leer user_roles/profiles).
--   2) Vista products_safe (security_invoker=true → respeta la RLS de products
--      a nivel fila) que devuelve purchase_price solo si app_can_view_cost();
--      en caso contrario NULL.
-- La app debe leer de products_safe en las rutas de SOLO LECTURA/visualización.
-- Las escrituras siguen yendo a products.

-- 1) Helper de rol -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_can_view_cost()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- admin / super_admin siempre ven el costo
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active IS NOT FALSE
        AND lower(ur.role) IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(p.role) IN ('admin', 'super_admin')
    )
    -- o cualquier usuario con el permiso específico products.read_cost
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission = 'products.read_cost'
        AND up.is_active IS NOT FALSE
    );
$$;

GRANT EXECUTE ON FUNCTION public.app_can_view_cost() TO authenticated;

-- 2) Vista enmascarada -------------------------------------------------------
-- security_invoker = true: la vista hereda la RLS de products (aislamiento por
-- organización). Solo el costo se enmascara según el rol.
CREATE OR REPLACE VIEW public.products_safe
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.sku,
  p.name,
  p.description,
  p.category_id,
  p.brand,
  p.supplier_id,
  CASE WHEN public.app_can_view_cost() THEN p.purchase_price ELSE NULL END AS purchase_price,
  p.sale_price,
  p.wholesale_price,
  p.offer_price,
  p.has_offer,
  p.stock_quantity,
  p.min_stock,
  p.max_stock,
  p.unit_measure,
  p.barcode,
  p.images,
  p.image_url,
  p.weight,
  p.dimensions,
  p.location,
  p.tags,
  p.is_active,
  p.featured,
  p.created_at,
  p.updated_at,
  p.brand_id,
  p.visibility,
  p.warranty_months,
  p.warranty_info,
  p.return_window_days,
  p.exchange_window_days,
  p.return_policy,
  p.exchange_policy,
  p.stock_status_computed,
  p.organization_id
FROM public.products p;

GRANT SELECT ON public.products_safe TO authenticated;

COMMENT ON VIEW public.products_safe IS
  'Espejo de products con purchase_price enmascarado para roles sin permiso (no admin). Usar en lecturas de visualización; escribir siempre en products.';
