
-- Fix get_category_stats
CREATE OR REPLACE FUNCTION public.get_category_stats()
RETURNS TABLE (
    category_id UUID,
    category_name VARCHAR,
    category_color VARCHAR,
    product_count BIGINT,
    total_stock BIGINT,
    total_value DECIMAL,
    avg_price DECIMAL,
    low_stock_count BIGINT
) 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        NULL::text,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.stock_quantity), 0) as total_stock,
        COALESCE(SUM(p.stock_quantity * p.purchase_price), 0) as total_value,
        COALESCE(ROUND(AVG(p.sale_price)::numeric, 2), 0) as avg_price,
        COUNT(p.id) FILTER (WHERE p.stock_quantity <= p.min_stock) as low_stock_count
    FROM public.categories c
    LEFT JOIN public.products p ON c.id = p.category_id AND p.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id, c.name
    ORDER BY product_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Fix get_storage_usage
CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS TABLE (
  category text,
  size_bytes bigint,
  size_mb numeric,
  percentage numeric
) 
SET search_path = public
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_db_size bigint;
BEGIN
  -- Get total database size
  SELECT pg_database_size(current_database()) INTO total_db_size;
  
  RETURN QUERY
  WITH storage_data AS (
    SELECT 
      'Tablas' as category,
      SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename))) as size_bytes
    FROM pg_tables 
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    
    UNION ALL
    
    SELECT 
      'Índices' as category,
      SUM(pg_indexes_size(format('%I.%I', schemaname, tablename))) as size_bytes
    FROM pg_tables 
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  )
  SELECT 
    sd.category,
    sd.size_bytes,
    ROUND(sd.size_bytes / 1024.0 / 1024.0, 2) as size_mb,
    ROUND((sd.size_bytes::numeric / NULLIF(total_db_size, 0)::numeric) * 100, 2) as percentage
  FROM storage_data sd
  ORDER BY sd.size_bytes DESC;
END;
$$;

-- Fix update_product_stock
CREATE OR REPLACE FUNCTION public.update_product_stock(
    product_id UUID,
    quantity_change INTEGER,
    movement_type VARCHAR(20),
    reference VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Obtener stock actual
    SELECT stock_quantity INTO current_stock
    FROM public.products
    WHERE id = product_id;
    
    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    
    -- Calcular nuevo stock
    new_stock := current_stock + quantity_change;
    
    -- Validar que el stock no sea negativo
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente. Stock actual: %, Cambio solicitado: %', current_stock, quantity_change;
    END IF;
    
    -- Actualizar stock del producto
    UPDATE public.products
    SET stock_quantity = new_stock,
        updated_at = timezone('utc'::text, now())
    WHERE id = product_id;
    
    -- Registrar movimiento de stock
    INSERT INTO public.stock_movements (
        product_id,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        reference,
        notes
    ) VALUES (
        product_id,
        movement_type,
        quantity_change,
        current_stock,
        new_stock,
        reference,
        notes
    );
    
    RETURN TRUE;
END;
$$;

-- Fix get_product_stats
CREATE OR REPLACE FUNCTION public.get_product_stats()
RETURNS JSON
SET search_path = public
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_products', COUNT(*),
        'active_products', COUNT(*) FILTER (WHERE is_active = true),
        'low_stock_products', COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND is_active = true),
        'out_of_stock_products', COUNT(*) FILTER (WHERE stock_quantity = 0 AND is_active = true),
        'total_stock_value', COALESCE(SUM(stock_quantity * cost_price), 0)
    ) INTO result
    FROM public.products;
    
    RETURN result;
END;
$$;
