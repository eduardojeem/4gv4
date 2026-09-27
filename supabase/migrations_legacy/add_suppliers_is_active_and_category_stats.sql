-- ============================================================
-- 1. Agregar columna is_active a la tabla suppliers
-- ============================================================
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Comentario en la columna
COMMENT ON COLUMN public.suppliers.is_active IS 'Indica si el proveedor está activo en el sistema';

-- Índice para filtrado eficiente
CREATE INDEX IF NOT EXISTS suppliers_is_active_idx ON public.suppliers (is_active);


-- ============================================================
-- 2. Crear función RPC get_category_stats
-- ============================================================
-- DROP requerido porque el tipo de retorno cambió respecto a la versión anterior
DROP FUNCTION IF EXISTS public.get_category_stats();

CREATE OR REPLACE FUNCTION public.get_category_stats()
RETURNS TABLE (
  category_id        UUID,
  category_name      TEXT,
  product_count      BIGINT,
  total_stock_value  NUMERIC,
  avg_margin_percentage NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id                                                           AS category_id,
    c.name                                                         AS category_name,
    COUNT(p.id)                                                    AS product_count,
    COALESCE(SUM(p.sale_price * p.stock_quantity), 0)             AS total_stock_value,
    COALESCE(
      AVG(
        CASE
          WHEN p.purchase_price > 0
          THEN ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
          ELSE 0
        END
      ), 0
    )                                                              AS avg_margin_percentage
  FROM public.categories c
  LEFT JOIN public.products p ON p.category_id = c.id AND p.is_active = true
  GROUP BY c.id, c.name
  ORDER BY c.name;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.get_category_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_stats() TO service_role;
