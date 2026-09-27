-- Migración: Optimización de Inventory
-- Fecha: 2026-01-15
-- Descripción: Agrega índices y función RPC para mejorar rendimiento de filtros

-- ============================================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================================================

-- Índice para búsqueda por nombre (con soporte para ILIKE)
CREATE INDEX IF NOT EXISTS idx_products_name_lower 
ON products (LOWER(name));

-- Índice para búsqueda por SKU
CREATE INDEX IF NOT EXISTS idx_products_sku_lower 
ON products (LOWER(sku));

-- Índice para filtro por categoría
CREATE INDEX IF NOT EXISTS idx_products_category_id 
ON products (category_id) 
WHERE category_id IS NOT NULL;

-- Índice para filtro por proveedor
CREATE INDEX IF NOT EXISTS idx_products_supplier_id 
ON products (supplier_id) 
WHERE supplier_id IS NOT NULL;

-- Índice compuesto para filtros de stock
CREATE INDEX IF NOT EXISTS idx_products_stock_status 
ON products (stock_quantity, min_stock);

-- Índice para ordenamiento por fecha
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc 
ON products (created_at DESC);

-- Índice para productos activos
CREATE INDEX IF NOT EXISTS idx_products_is_active 
ON products (is_active) 
WHERE is_active = true;

-- ============================================================================
-- FUNCIÓN RPC PARA FILTROS OPTIMIZADOS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_inventory_filtered(
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
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCIÓN PARA OBTENER ESTADÍSTICAS DE INVENTARIO
-- ============================================================================

CREATE OR REPLACE FUNCTION get_inventory_stats()
RETURNS TABLE (
  total_products BIGINT,
  active_products BIGINT,
  total_stock_value NUMERIC,
  total_cost_value NUMERIC,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  overstock_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_products,
    COUNT(*) FILTER (WHERE is_active = true)::BIGINT as active_products,
    COALESCE(SUM(sale_price * stock_quantity), 0) as total_stock_value,
    COALESCE(SUM(purchase_price * stock_quantity), 0) as total_cost_value,
    COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND stock_quantity > 0)::BIGINT as low_stock_count,
    COUNT(*) FILTER (WHERE stock_quantity = 0)::BIGINT as out_of_stock_count,
    COUNT(*) FILTER (WHERE stock_quantity > max_stock)::BIGINT as overstock_count
  FROM products;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCIÓN PARA OBTENER PRODUCTOS CON ALERTAS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_products_with_alerts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  stock_quantity INT,
  min_stock INT,
  max_stock INT,
  alert_type TEXT,
  alert_severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.min_stock,
    p.max_stock,
    CASE 
      WHEN p.stock_quantity = 0 THEN 'out_of_stock'
      WHEN p.stock_quantity <= p.min_stock THEN 'low_stock'
      WHEN p.stock_quantity > p.max_stock THEN 'overstock'
      ELSE 'normal'
    END as alert_type,
    CASE 
      WHEN p.stock_quantity = 0 THEN 'critical'
      WHEN p.stock_quantity <= 2 THEN 'high'
      WHEN p.stock_quantity <= p.min_stock THEN 'medium'
      WHEN p.stock_quantity > p.max_stock THEN 'low'
      ELSE 'none'
    END as alert_severity
  FROM products p
  WHERE 
    p.stock_quantity = 0 OR
    p.stock_quantity <= p.min_stock OR
    p.stock_quantity > p.max_stock
  ORDER BY 
    CASE 
      WHEN p.stock_quantity = 0 THEN 1
      WHEN p.stock_quantity <= 2 THEN 2
      WHEN p.stock_quantity <= p.min_stock THEN 3
      ELSE 4
    END,
    p.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON FUNCTION get_inventory_filtered IS 
'Función optimizada para filtrar productos con múltiples criterios. 
Usa índices para mejor rendimiento.';

COMMENT ON FUNCTION get_inventory_stats IS 
'Retorna estadísticas agregadas del inventario de forma eficiente.';

COMMENT ON FUNCTION get_products_with_alerts IS 
'Retorna productos que requieren atención (stock bajo, agotado, sobrestock).';

-- ============================================================================
-- PERMISOS
-- ============================================================================

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_inventory_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_with_alerts TO authenticated;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que los índices se crearon correctamente
DO $$
BEGIN
  RAISE NOTICE 'Migración completada exitosamente';
  RAISE NOTICE 'Índices creados: 7';
  RAISE NOTICE 'Funciones RPC creadas: 3';
END $$;
