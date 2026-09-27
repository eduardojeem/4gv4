-- Fix function public.get_category_stats has a role mutable search_path
-- Adding SET search_path = public to the function definition

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
SET search_path = public
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
