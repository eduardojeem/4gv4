CREATE OR REPLACE FUNCTION public.get_inventory_filtered(
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_stock_status TEXT DEFAULT 'all',
  p_is_active BOOLEAN DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  category_id UUID,
  category_name TEXT,
  supplier_id UUID,
  supplier_name TEXT,
  sale_price NUMERIC,
  purchase_price NUMERIC,
  wholesale_price NUMERIC,
  stock_quantity INT,
  min_stock INT,
  max_stock INT,
  is_active BOOLEAN,
  unit_measure TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.category_id,
    c.name as category_name,
    p.supplier_id,
    s.name as supplier_name,
    p.sale_price,
    p.purchase_price,
    p.wholesale_price,
    p.stock_quantity,
    p.min_stock,
    p.max_stock,
    p.is_active,
    p.unit_measure,
    p.description,
    p.created_at,
    p.updated_at
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN suppliers s ON p.supplier_id = s.id
  WHERE 
    -- Filtro de búsqueda
    (p_search IS NULL OR 
     LOWER(p.name) LIKE LOWER('%' || p_search || '%') OR 
     LOWER(p.sku) LIKE LOWER('%' || p_search || '%') OR
     LOWER(p.description) LIKE LOWER('%' || p_search || '%'))
    
    -- Filtro de categoría
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    
    -- Filtro de proveedor
    AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
    
    -- Filtro de estado activo
    AND (p_is_active IS NULL OR p.is_active = p_is_active)
    
    -- Filtro de stock
    AND (
      p_stock_status = 'all' OR
      (p_stock_status = 'low_stock' AND p.stock_quantity <= p.min_stock AND p.stock_quantity > 0) OR
      (p_stock_status = 'out_of_stock' AND p.stock_quantity = 0) OR
      (p_stock_status = 'in_stock' AND p.stock_quantity > 0) OR
      (p_stock_status = 'overstock' AND p.stock_quantity > p.max_stock)
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
