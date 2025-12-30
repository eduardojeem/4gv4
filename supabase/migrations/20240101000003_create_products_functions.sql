CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_price DECIMAL(10,2) DEFAULT 0,
    sale_price DECIMAL(10,2) NOT NULL,
    wholesale_price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    unit_measure VARCHAR(50) DEFAULT 'unidad',
    images TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_id UUID,
    reference_type VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
 -- Vista para productos con información completa
DROP VIEW IF EXISTS products_detailed CASCADE;
CREATE OR REPLACE VIEW products_detailed AS
 SELECT 
     p.*,
     c.name as category_name,
    NULL::text as category_color,
    NULL::text as category_icon,
    s.name as supplier_name,
    s.contact_name as supplier_contact,
    s.email as supplier_email,
    s.phone as supplier_phone,
    -- Calcular margen de ganancia
    CASE 
        WHEN p.purchase_price > 0 THEN 
            ROUND(((p.sale_price - p.purchase_price) / p.purchase_price * 100)::numeric, 2)
        ELSE 0 
    END as profit_margin_percentage,
    -- Valor total del stock
    (p.stock_quantity * p.purchase_price) as total_stock_value,
    -- Estado del stock
    CASE 
        WHEN p.stock_quantity = 0 THEN 'out_of_stock'
        WHEN p.stock_quantity <= p.min_stock THEN 'low_stock'
        ELSE 'normal'
    END as stock_status,
    -- Contar alertas activas
    (SELECT COUNT(*) FROM product_alerts pa WHERE pa.product_id = p.id AND pa.is_resolved = false) as active_alerts_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id;

-- Vista para estadísticas del dashboard
DROP VIEW IF EXISTS products_dashboard_stats CASCADE;
CREATE OR REPLACE VIEW products_dashboard_stats AS
SELECT 
    -- Totales generales
    COUNT(*) as total_products,
    COUNT(*) FILTER (WHERE is_active = true) as active_products,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_products,
    SUM(stock_quantity) as total_stock,
    SUM(stock_quantity * purchase_price) as total_inventory_value,
    
    -- Alertas
    COUNT(*) FILTER (WHERE stock_quantity = 0) as out_of_stock_count,
    COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND stock_quantity > 0) as low_stock_count,
    COUNT(*) FILTER (WHERE supplier_id IS NULL) as no_supplier_count,
    COUNT(*) FILTER (WHERE category_id IS NULL) as no_category_count,
    COUNT(*) FILTER (WHERE images IS NULL OR array_length(images, 1) IS NULL) as no_image_count,
    
    -- Promedios
    ROUND(AVG(sale_price)::numeric, 2) as avg_sale_price,
    ROUND(AVG(purchase_price)::numeric, 2) as avg_purchase_price,
    ROUND(AVG(CASE WHEN purchase_price > 0 THEN (sale_price - purchase_price) / purchase_price * 100 ELSE 0 END)::numeric, 2) as avg_profit_margin
FROM products;

-- Función para obtener productos más vendidos (simulado con movimientos)
DROP FUNCTION IF EXISTS get_top_selling_products(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION get_top_selling_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR,
    product_sku VARCHAR,
    category_name VARCHAR,
    total_sold INTEGER,
    total_revenue DECIMAL,
    current_stock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.sku,
        c.name,
        COALESCE(SUM(pm.quantity) FILTER (WHERE pm.movement_type IN ('sale', 'exit')), 0)::INTEGER as total_sold,
        COALESCE(SUM(pm.quantity * p.sale_price) FILTER (WHERE pm.movement_type IN ('sale', 'exit')), 0) as total_revenue,
        p.stock_quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_movements pm ON p.id = pm.product_id
    WHERE p.is_active = true
    GROUP BY p.id, p.name, p.sku, c.name, p.stock_quantity
    ORDER BY total_sold DESC, total_revenue DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener movimientos recientes
DROP FUNCTION IF EXISTS get_recent_movements(INTEGER, INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION get_recent_movements(days INTEGER DEFAULT 30, limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
    movement_id UUID,
    product_name VARCHAR,
    product_sku VARCHAR,
    movement_type VARCHAR,
    quantity INTEGER,
    previous_stock INTEGER,
    new_stock INTEGER,
    total_cost DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.id,
        p.name,
        p.sku,
        pm.movement_type,
        pm.quantity,
        pm.previous_stock,
        pm.new_stock,
        pm.total_cost,
        pm.created_at,
        pm.notes
    FROM product_movements pm
    JOIN products p ON pm.product_id = p.id
    WHERE pm.created_at >= NOW() - INTERVAL '%s days' % days
    ORDER BY pm.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas por categoría
DROP FUNCTION IF EXISTS get_category_stats() CASCADE;
CREATE OR REPLACE FUNCTION get_category_stats()
RETURNS TABLE (
    category_id UUID,
    category_name VARCHAR,
    category_color VARCHAR,
    product_count BIGINT,
    total_stock BIGINT,
    total_value DECIMAL,
    avg_price DECIMAL,
    low_stock_count BIGINT
) AS $$
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
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id, c.name
    ORDER BY product_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas por proveedor
DROP FUNCTION IF EXISTS get_supplier_stats() CASCADE;
CREATE OR REPLACE FUNCTION get_supplier_stats()
RETURNS TABLE (
    supplier_id UUID,
    supplier_name VARCHAR,
    product_count BIGINT,
    total_stock BIGINT,
    total_value DECIMAL,
    avg_payment_terms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.stock_quantity), 0) as total_stock,
        COALESCE(SUM(p.stock_quantity * p.purchase_price), 0) as total_value,
        NULL::INTEGER
    FROM suppliers s
    LEFT JOIN products p ON s.id = p.supplier_id AND p.is_active = true
    WHERE s.is_active = true
    GROUP BY s.id, s.name
    ORDER BY total_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para buscar productos
DROP FUNCTION IF EXISTS search_products(TEXT, UUID, UUID, VARCHAR, VARCHAR, INTEGER, INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION search_products(
    search_term TEXT DEFAULT '',
    category_filter UUID DEFAULT NULL,
    supplier_filter UUID DEFAULT NULL,
    status_filter VARCHAR DEFAULT NULL,
    stock_filter VARCHAR DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    sku VARCHAR,
    name VARCHAR,
    description TEXT,
    category_name VARCHAR,
    category_color VARCHAR,
    brand VARCHAR,
    supplier_name VARCHAR,
    purchase_price DECIMAL,
    sale_price DECIMAL,
    wholesale_price DECIMAL,
    stock INTEGER,
    min_stock INTEGER,
    status VARCHAR,
    stock_status VARCHAR,
    profit_margin DECIMAL,
    total_value DECIMAL,
    active_alerts INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.description,
        c.name as category_name,
        NULL::text as category_color,
        p.brand,
        s.name as supplier_name,
        p.purchase_price,
        p.sale_price,
        p.wholesale_price,
        p.stock_quantity,
        p.min_stock,
        CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END as status,
        CASE 
            WHEN p.stock_quantity = 0 THEN 'out_of_stock'
            WHEN p.stock_quantity <= p.min_stock THEN 'low_stock'
            ELSE 'normal'
        END as stock_status,
        CASE 
            WHEN p.purchase_price > 0 THEN 
                ROUND(((p.sale_price - p.purchase_price) / p.purchase_price * 100)::numeric, 2)
            ELSE 0 
        END as profit_margin,
        (p.stock_quantity * p.purchase_price) as total_value,
        (SELECT COUNT(*)::INTEGER FROM product_alerts pa WHERE pa.product_id = p.id AND pa.is_resolved = false) as active_alerts,
        p.created_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 
        (search_term = '' OR 
         p.name ILIKE '%' || search_term || '%' OR 
         p.sku ILIKE '%' || search_term || '%' OR 
         p.brand ILIKE '%' || search_term || '%' OR
         p.description ILIKE '%' || search_term || '%')
        AND (category_filter IS NULL OR p.category_id = category_filter)
        AND (supplier_filter IS NULL OR p.supplier_id = supplier_filter)
        AND (status_filter IS NULL OR (status_filter = 'active' AND p.is_active = true) OR (status_filter = 'inactive' AND p.is_active = false))
        AND (stock_filter IS NULL OR 
             (stock_filter = 'low' AND p.stock_quantity <= p.min_stock) OR
             (stock_filter = 'out' AND p.stock_quantity = 0) OR
             (stock_filter = 'normal' AND p.stock_quantity > p.min_stock))
    ORDER BY 
        CASE WHEN p.stock_quantity = 0 THEN 0 ELSE 1 END,
        CASE WHEN p.stock_quantity <= p.min_stock THEN 0 ELSE 1 END,
        p.name
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar stock de producto
CREATE OR REPLACE FUNCTION update_product_stock(
    product_id_param UUID,
    new_stock INTEGER,
    movement_type_param VARCHAR,
    reference_type_param VARCHAR DEFAULT NULL,
    reference_id_param UUID DEFAULT NULL,
    notes_param TEXT DEFAULT NULL,
    unit_cost_param DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
    product_exists BOOLEAN;
BEGIN
    -- Verificar que el producto existe
    SELECT stock INTO current_stock FROM products WHERE id = product_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    
    -- Actualizar el stock
    UPDATE products 
    SET 
        stock = new_stock,
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE id = product_id_param;
    
    -- Registrar el movimiento
    INSERT INTO product_movements (
        product_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        unit_cost,
        total_cost,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        product_id_param,
        movement_type_param,
        ABS(new_stock - current_stock),
        current_stock,
        new_stock,
        unit_cost_param,
        CASE WHEN unit_cost_param IS NOT NULL THEN unit_cost_param * ABS(new_stock - current_stock) ELSE NULL END,
        reference_type_param,
        reference_id_param,
        notes_param,
        auth.uid()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para generar reporte de inventario
CREATE OR REPLACE FUNCTION generate_inventory_report(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    category_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    product_id UUID,
    sku VARCHAR,
    product_name VARCHAR,
    category_name VARCHAR,
    current_stock INTEGER,
    stock_value DECIMAL,
    entries INTEGER,
    exits INTEGER,
    net_movement INTEGER,
    turnover_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        c.name as category_name,
        p.stock as current_stock,
        (p.stock * p.purchase_price) as stock_value,
        COALESCE(SUM(pm.quantity) FILTER (WHERE pm.movement_type IN ('entry', 'adjustment') AND pm.quantity > 0), 0)::INTEGER as entries,
        COALESCE(SUM(pm.quantity) FILTER (WHERE pm.movement_type IN ('exit', 'sale') AND pm.quantity > 0), 0)::INTEGER as exits,
        COALESCE(SUM(CASE 
            WHEN pm.movement_type IN ('entry', 'adjustment') AND pm.quantity > 0 THEN pm.quantity
            WHEN pm.movement_type IN ('exit', 'sale') AND pm.quantity > 0 THEN -pm.quantity
            ELSE 0
        END), 0)::INTEGER as net_movement,
        CASE 
            WHEN p.stock > 0 THEN 
                ROUND((COALESCE(SUM(pm.quantity) FILTER (WHERE pm.movement_type IN ('exit', 'sale')), 0) / p.stock::DECIMAL), 2)
            ELSE 0 
        END as turnover_rate
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_movements pm ON p.id = pm.product_id 
        AND (start_date IS NULL OR pm.created_at >= start_date)
        AND (end_date IS NULL OR pm.created_at <= end_date)
    WHERE 
        p.status = 'active'
        AND (category_filter IS NULL OR p.category_id = category_filter)
    GROUP BY p.id, p.sku, p.name, c.name, p.stock, p.purchase_price
    ORDER BY stock_value DESC;
END;
$$ LANGUAGE plpgsql;
