-- =====================================================
-- REDISEÑO MODERNO DE TABLAS DE PRODUCTOS
-- Versión: 2.0 - Diseño Intuitivo y Optimizado
-- =====================================================

BEGIN;

-- =====================================================
-- 1. MODERNIZAR TABLA PRODUCTS
-- =====================================================

-- Agregar nuevas columnas modernas si no existen
DO $$ 
BEGIN
  -- Información de visualización mejorada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='display_name') THEN
    ALTER TABLE products ADD COLUMN display_name TEXT;
    COMMENT ON COLUMN products.display_name IS 'Nombre corto para mostrar en UI (ej: "iPhone 15 Pro")';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='short_description') THEN
    ALTER TABLE products ADD COLUMN short_description TEXT;
    COMMENT ON COLUMN products.short_description IS 'Descripción corta para cards y listas (max 100 chars)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='long_description') THEN
    ALTER TABLE products ADD COLUMN long_description TEXT;
    COMMENT ON COLUMN products.long_description IS 'Descripción detallada con formato markdown';
  END IF;

  -- Multimedia mejorada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='thumbnail') THEN
    ALTER TABLE products ADD COLUMN thumbnail TEXT;
    COMMENT ON COLUMN products.thumbnail IS 'URL de imagen miniatura optimizada (200x200)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='video_url') THEN
    ALTER TABLE products ADD COLUMN video_url TEXT;
    COMMENT ON COLUMN products.video_url IS 'URL de video del producto (YouTube, Vimeo, etc)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='gallery') THEN
    ALTER TABLE products ADD COLUMN gallery JSONB DEFAULT '[]'::jsonb;
    COMMENT ON COLUMN products.gallery IS 'Galería de imágenes con metadata: [{url, alt, order, type}]';
  END IF;

  -- Organización y búsqueda
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='slug') THEN
    ALTER TABLE products ADD COLUMN slug TEXT UNIQUE;
    COMMENT ON COLUMN products.slug IS 'URL-friendly identifier (ej: "iphone-15-pro-128gb")';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='search_keywords') THEN
    ALTER TABLE products ADD COLUMN search_keywords TEXT[];
    COMMENT ON COLUMN products.search_keywords IS 'Keywords para búsqueda optimizada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='color') THEN
    ALTER TABLE products ADD COLUMN color TEXT;
    COMMENT ON COLUMN products.color IS 'Color principal del producto';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='size') THEN
    ALTER TABLE products ADD COLUMN size TEXT;
    COMMENT ON COLUMN products.size IS 'Talla o tamaño del producto';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='model') THEN
    ALTER TABLE products ADD COLUMN model TEXT;
    COMMENT ON COLUMN products.model IS 'Modelo específico del producto';
  END IF;

  -- Especificaciones técnicas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='specifications') THEN
    ALTER TABLE products ADD COLUMN specifications JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN products.specifications IS 'Especificaciones técnicas estructuradas';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='features') THEN
    ALTER TABLE products ADD COLUMN features TEXT[];
    COMMENT ON COLUMN products.features IS 'Lista de características destacadas';
  END IF;

  -- Información de stock mejorada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock_status') THEN
    ALTER TABLE products ADD COLUMN stock_status TEXT DEFAULT 'in_stock' 
      CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued', 'pre_order'));
    COMMENT ON COLUMN products.stock_status IS 'Estado visual del stock para UI';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='restock_date') THEN
    ALTER TABLE products ADD COLUMN restock_date TIMESTAMPTZ;
    COMMENT ON COLUMN products.restock_date IS 'Fecha estimada de reabastecimiento';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='allow_backorder') THEN
    ALTER TABLE products ADD COLUMN allow_backorder BOOLEAN DEFAULT false;
    COMMENT ON COLUMN products.allow_backorder IS 'Permitir pedidos sin stock';
  END IF;

  -- Precios y promociones mejorados
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='compare_at_price') THEN
    ALTER TABLE products ADD COLUMN compare_at_price NUMERIC(12,2);
    COMMENT ON COLUMN products.compare_at_price IS 'Precio de comparación (antes: $X)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='discount_percentage') THEN
    ALTER TABLE products ADD COLUMN discount_percentage INTEGER;
    COMMENT ON COLUMN products.discount_percentage IS 'Porcentaje de descuento calculado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='promotion_label') THEN
    ALTER TABLE products ADD COLUMN promotion_label TEXT;
    COMMENT ON COLUMN products.promotion_label IS 'Etiqueta de promoción (ej: "OFERTA", "NUEVO", "HOT")';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='promotion_start') THEN
    ALTER TABLE products ADD COLUMN promotion_start TIMESTAMPTZ;
    COMMENT ON COLUMN products.promotion_start IS 'Inicio de promoción';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='promotion_end') THEN
    ALTER TABLE products ADD COLUMN promotion_end TIMESTAMPTZ;
    COMMENT ON COLUMN products.promotion_end IS 'Fin de promoción';
  END IF;

  -- Métricas y analytics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='view_count') THEN
    ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0;
    COMMENT ON COLUMN products.view_count IS 'Número de vistas del producto';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sales_count') THEN
    ALTER TABLE products ADD COLUMN sales_count INTEGER DEFAULT 0;
    COMMENT ON COLUMN products.sales_count IS 'Número de ventas realizadas';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='rating_average') THEN
    ALTER TABLE products ADD COLUMN rating_average NUMERIC(3,2) DEFAULT 0;
    COMMENT ON COLUMN products.rating_average IS 'Calificación promedio (0-5)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='rating_count') THEN
    ALTER TABLE products ADD COLUMN rating_count INTEGER DEFAULT 0;
    COMMENT ON COLUMN products.rating_count IS 'Número de calificaciones';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='last_sold_at') THEN
    ALTER TABLE products ADD COLUMN last_sold_at TIMESTAMPTZ;
    COMMENT ON COLUMN products.last_sold_at IS 'Última fecha de venta';
  END IF;

  -- SEO y metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='meta_title') THEN
    ALTER TABLE products ADD COLUMN meta_title TEXT;
    COMMENT ON COLUMN products.meta_title IS 'Título SEO para motores de búsqueda';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='meta_description') THEN
    ALTER TABLE products ADD COLUMN meta_description TEXT;
    COMMENT ON COLUMN products.meta_description IS 'Descripción SEO';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='meta_keywords') THEN
    ALTER TABLE products ADD COLUMN meta_keywords TEXT[];
    COMMENT ON COLUMN products.meta_keywords IS 'Keywords SEO';
  END IF;

  -- Información adicional
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='warranty_info') THEN
    ALTER TABLE products ADD COLUMN warranty_info TEXT;
    COMMENT ON COLUMN products.warranty_info IS 'Información de garantía';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='shipping_info') THEN
    ALTER TABLE products ADD COLUMN shipping_info TEXT;
    COMMENT ON COLUMN products.shipping_info IS 'Información de envío';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='return_policy') THEN
    ALTER TABLE products ADD COLUMN return_policy TEXT;
    COMMENT ON COLUMN products.return_policy IS 'Política de devolución';
  END IF;

  -- Flags de estado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_new') THEN
    ALTER TABLE products ADD COLUMN is_new BOOLEAN DEFAULT false;
    COMMENT ON COLUMN products.is_new IS 'Producto nuevo (mostrar badge "NUEVO")';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_bestseller') THEN
    ALTER TABLE products ADD COLUMN is_bestseller BOOLEAN DEFAULT false;
    COMMENT ON COLUMN products.is_bestseller IS 'Producto más vendido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_trending') THEN
    ALTER TABLE products ADD COLUMN is_trending BOOLEAN DEFAULT false;
    COMMENT ON COLUMN products.is_trending IS 'Producto en tendencia';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_exclusive') THEN
    ALTER TABLE products ADD COLUMN is_exclusive BOOLEAN DEFAULT false;
    COMMENT ON COLUMN products.is_exclusive IS 'Producto exclusivo';
  END IF;

  -- Ordenamiento y prioridad
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sort_order') THEN
    ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;
    COMMENT ON COLUMN products.sort_order IS 'Orden de visualización (menor = primero)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='priority') THEN
    ALTER TABLE products ADD COLUMN priority TEXT DEFAULT 'normal' 
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    COMMENT ON COLUMN products.priority IS 'Prioridad del producto';
  END IF;

END $$;

-- =====================================================
-- 2. CREAR ÍNDICES OPTIMIZADOS
-- =====================================================

-- Índices para búsqueda y filtrado
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_display_name ON products(display_name);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new);
CREATE INDEX IF NOT EXISTS idx_products_is_bestseller ON products(is_bestseller);
CREATE INDEX IF NOT EXISTS idx_products_is_trending ON products(is_trending);

-- Índices para ordenamiento
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_sales_count ON products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_view_count ON products(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_rating_average ON products(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_last_sold_at ON products(last_sold_at DESC);

-- Índices para precios
CREATE INDEX IF NOT EXISTS idx_products_sale_price ON products(sale_price);
CREATE INDEX IF NOT EXISTS idx_products_discount_percentage ON products(discount_percentage DESC);

-- Índices para promociones
CREATE INDEX IF NOT EXISTS idx_products_promotion_active ON products(promotion_start, promotion_end) 
  WHERE promotion_start IS NOT NULL AND promotion_end IS NOT NULL;

-- Índices GIN para búsqueda de texto y arrays
CREATE INDEX IF NOT EXISTS idx_products_search_keywords ON products USING GIN(search_keywords);
CREATE INDEX IF NOT EXISTS idx_products_features ON products USING GIN(features);
CREATE INDEX IF NOT EXISTS idx_products_meta_keywords ON products USING GIN(meta_keywords);

-- Índices GIN para JSONB
CREATE INDEX IF NOT EXISTS idx_products_specifications ON products USING GIN(specifications);
CREATE INDEX IF NOT EXISTS idx_products_gallery ON products USING GIN(gallery);

-- Índice de texto completo
CREATE INDEX IF NOT EXISTS idx_products_fulltext ON products USING GIN(
  to_tsvector('spanish', 
    COALESCE(name, '') || ' ' || 
    COALESCE(display_name, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(short_description, '') || ' ' || 
    COALESCE(brand, '') || ' ' || 
    COALESCE(sku, '')
  )
);

-- =====================================================
-- 3. CREAR FUNCIONES AUXILIARES MODERNAS
-- =====================================================

-- Función para generar slug automáticamente
CREATE OR REPLACE FUNCTION generate_product_slug(product_name TEXT, product_id UUID)
RETURNS TEXT 
SET search_path = public
AS $
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convertir nombre a slug
  base_slug := lower(trim(product_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  
  final_slug := base_slug;
  
  -- Verificar unicidad
  WHILE EXISTS (SELECT 1 FROM products WHERE slug = final_slug AND id != product_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$ LANGUAGE plpgsql;

-- Función para calcular porcentaje de descuento
CREATE OR REPLACE FUNCTION calculate_discount_percentage(sale_price NUMERIC, compare_price NUMERIC)
RETURNS INTEGER 
SET search_path = public
AS $
BEGIN
  IF compare_price IS NULL OR compare_price <= 0 OR sale_price >= compare_price THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(((compare_price - sale_price) / compare_price * 100)::NUMERIC);
END;
$ LANGUAGE plpgsql IMMUTABLE;

-- Función para actualizar stock_status automáticamente
CREATE OR REPLACE FUNCTION update_product_stock_status()
RETURNS TRIGGER 
SET search_path = public
AS $
BEGIN
  IF NEW.stock_quantity <= 0 THEN
    NEW.stock_status := 'out_of_stock';
  ELSIF NEW.stock_quantity <= NEW.min_stock THEN
    NEW.stock_status := 'low_stock';
  ELSE
    NEW.stock_status := 'in_stock';
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Función para actualizar discount_percentage automáticamente
CREATE OR REPLACE FUNCTION update_product_discount()
RETURNS TRIGGER 
SET search_path = public
AS $
BEGIN
  NEW.discount_percentage := calculate_discount_percentage(NEW.sale_price, NEW.compare_at_price);
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Función para generar slug automáticamente
CREATE OR REPLACE FUNCTION auto_generate_slug()
RETURNS TRIGGER 
SET search_path = public
AS $
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_product_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREAR TRIGGERS
-- =====================================================

-- Trigger para actualizar stock_status
DROP TRIGGER IF EXISTS trigger_update_stock_status ON products;
CREATE TRIGGER trigger_update_stock_status
  BEFORE INSERT OR UPDATE OF stock_quantity, min_stock
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_status();

-- Trigger para actualizar discount_percentage
DROP TRIGGER IF EXISTS trigger_update_discount ON products;
CREATE TRIGGER trigger_update_discount
  BEFORE INSERT OR UPDATE OF sale_price, compare_at_price
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_discount();

-- Trigger para generar slug
DROP TRIGGER IF EXISTS trigger_auto_generate_slug ON products;
CREATE TRIGGER trigger_auto_generate_slug
  BEFORE INSERT OR UPDATE OF name
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_slug();

-- =====================================================
-- 5. CREAR VISTA MODERNA DE PRODUCTOS
-- =====================================================

CREATE OR REPLACE VIEW products_modern_view AS
SELECT 
  p.id,
  p.sku,
  p.name,
  p.display_name,
  p.slug,
  p.short_description,
  p.long_description,
  p.description,
  
  -- Multimedia
  p.thumbnail,
  p.images,
  p.gallery,
  p.video_url,
  
  -- Categorización
  p.category_id,
  c.name as category_name,
  c.slug as category_slug,
  p.brand,
  p.model,
  p.color,
  p.size,
  
  -- Proveedor
  p.supplier_id,
  s.name as supplier_name,
  
  -- Precios
  p.purchase_price,
  p.sale_price,
  p.wholesale_price,
  p.compare_at_price,
  p.discount_percentage,
  
  -- Promociones
  p.promotion_label,
  p.promotion_start,
  p.promotion_end,
  CASE 
    WHEN p.promotion_start IS NOT NULL 
      AND p.promotion_end IS NOT NULL 
      AND NOW() BETWEEN p.promotion_start AND p.promotion_end 
    THEN true 
    ELSE false 
  END as is_on_promotion,
  
  -- Stock
  p.stock_quantity,
  p.min_stock,
  p.max_stock,
  p.stock_status,
  p.restock_date,
  p.allow_backorder,
  p.unit_measure,
  
  -- Métricas
  p.view_count,
  p.sales_count,
  p.rating_average,
  p.rating_count,
  p.last_sold_at,
  
  -- Características
  p.specifications,
  p.features,
  p.search_keywords,
  
  -- Flags
  p.is_active,
  p.featured,
  p.is_new,
  p.is_bestseller,
  p.is_trending,
  p.is_exclusive,
  
  -- SEO
  p.meta_title,
  p.meta_description,
  p.meta_keywords,
  
  -- Información adicional
  p.warranty_info,
  p.shipping_info,
  p.return_policy,
  
  -- Ordenamiento
  p.sort_order,
  p.priority,
  
  -- Cálculos
  (p.sale_price * p.stock_quantity) as stock_value,
  (p.sale_price - p.purchase_price) as margin_amount,
  CASE 
    WHEN p.purchase_price > 0 
    THEN ROUND(((p.sale_price - p.purchase_price) / p.purchase_price * 100)::NUMERIC, 2)
    ELSE 0 
  END as margin_percentage,
  
  -- Timestamps
  p.created_at,
  p.updated_at,
  p.barcode,
  p.location,
  p.weight,
  p.dimensions,
  p.tags

FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id;

-- =====================================================
-- 6. FUNCIÓN DE BÚSQUEDA MODERNA
-- =====================================================

CREATE OR REPLACE FUNCTION search_products_modern(
  search_term TEXT DEFAULT NULL,
  category_filter UUID DEFAULT NULL,
  supplier_filter UUID DEFAULT NULL,
  min_price NUMERIC DEFAULT NULL,
  max_price NUMERIC DEFAULT NULL,
  stock_filter TEXT DEFAULT NULL,
  is_featured_filter BOOLEAN DEFAULT NULL,
  is_new_filter BOOLEAN DEFAULT NULL,
  is_bestseller_filter BOOLEAN DEFAULT NULL,
  is_trending_filter BOOLEAN DEFAULT NULL,
  sort_by TEXT DEFAULT 'relevance',
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  display_name TEXT,
  slug TEXT,
  thumbnail TEXT,
  sale_price NUMERIC,
  compare_at_price NUMERIC,
  discount_percentage INTEGER,
  stock_status TEXT,
  rating_average NUMERIC,
  rating_count INTEGER,
  is_new BOOLEAN,
  is_bestseller BOOLEAN,
  is_trending BOOLEAN,
  promotion_label TEXT,
  relevance_score REAL
) 
SET search_path = public
AS $
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.display_name,
    p.slug,
    p.thumbnail,
    p.sale_price,
    p.compare_at_price,
    p.discount_percentage,
    p.stock_status,
    p.rating_average,
    p.rating_count,
    p.is_new,
    p.is_bestseller,
    p.is_trending,
    p.promotion_label,
    CASE 
      WHEN search_term IS NOT NULL THEN
        ts_rank(
          to_tsvector('spanish', 
            COALESCE(p.name, '') || ' ' || 
            COALESCE(p.display_name, '') || ' ' || 
            COALESCE(p.description, '') || ' ' || 
            COALESCE(p.brand, '')
          ),
          plainto_tsquery('spanish', search_term)
        )
      ELSE 0
    END as relevance_score
  FROM products p
  WHERE 
    (search_term IS NULL OR 
      to_tsvector('spanish', 
        COALESCE(p.name, '') || ' ' || 
        COALESCE(p.display_name, '') || ' ' || 
        COALESCE(p.description, '') || ' ' || 
        COALESCE(p.brand, '') || ' ' || 
        COALESCE(p.sku, '')
      ) @@ plainto_tsquery('spanish', search_term)
    )
    AND (category_filter IS NULL OR p.category_id = category_filter)
    AND (supplier_filter IS NULL OR p.supplier_id = supplier_filter)
    AND (min_price IS NULL OR p.sale_price >= min_price)
    AND (max_price IS NULL OR p.sale_price <= max_price)
    AND (stock_filter IS NULL OR p.stock_status = stock_filter)
    AND (is_featured_filter IS NULL OR p.featured = is_featured_filter)
    AND (is_new_filter IS NULL OR p.is_new = is_new_filter)
    AND (is_bestseller_filter IS NULL OR p.is_bestseller = is_bestseller_filter)
    AND (is_trending_filter IS NULL OR p.is_trending = is_trending_filter)
    AND p.is_active = true
  ORDER BY
    CASE WHEN sort_by = 'relevance' AND search_term IS NOT NULL THEN relevance_score END DESC,
    CASE WHEN sort_by = 'price_asc' THEN p.sale_price END ASC,
    CASE WHEN sort_by = 'price_desc' THEN p.sale_price END DESC,
    CASE WHEN sort_by = 'newest' THEN p.created_at END DESC,
    CASE WHEN sort_by = 'bestseller' THEN p.sales_count END DESC,
    CASE WHEN sort_by = 'rating' THEN p.rating_average END DESC,
    CASE WHEN sort_by = 'name' THEN p.name END ASC,
    p.sort_order ASC,
    p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- MENSAJE DE CONFIRMACIÓN
-- =====================================================

DO $
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ REDISEÑO MODERNO COMPLETADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Nuevas columnas agregadas:';
  RAISE NOTICE '  - Visualización: display_name, short_description, thumbnail';
  RAISE NOTICE '  - Multimedia: gallery (JSONB), video_url';
  RAISE NOTICE '  - Organización: slug, search_keywords, color, size, model';
  RAISE NOTICE '  - Especificaciones: specifications (JSONB), features';
  RAISE NOTICE '  - Stock: stock_status, restock_date, allow_backorder';
  RAISE NOTICE '  - Precios: compare_at_price, discount_percentage';
  RAISE NOTICE '  - Promociones: promotion_label, promotion_start/end';
  RAISE NOTICE '  - Métricas: view_count, sales_count, rating_average';
  RAISE NOTICE '  - Flags: is_new, is_bestseller, is_trending, is_exclusive';
  RAISE NOTICE '  - SEO: meta_title, meta_description, meta_keywords';
  RAISE NOTICE '  - Info: warranty_info, shipping_info, return_policy';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Funciones creadas:';
  RAISE NOTICE '  - generate_product_slug()';
  RAISE NOTICE '  - calculate_discount_percentage()';
  RAISE NOTICE '  - search_products_modern()';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Triggers activos:';
  RAISE NOTICE '  - Auto-actualización de stock_status';
  RAISE NOTICE '  - Auto-cálculo de discount_percentage';
  RAISE NOTICE '  - Auto-generación de slug';
  RAISE NOTICE '';
  RAISE NOTICE '📈 Vista creada:';
  RAISE NOTICE '  - products_modern_view (con todos los datos relacionados)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Índices optimizados para:';
  RAISE NOTICE '  - Búsqueda de texto completo';
  RAISE NOTICE '  - Filtrado por múltiples criterios';
  RAISE NOTICE '  - Ordenamiento eficiente';
  RAISE NOTICE '  - Consultas JSONB';
  RAISE NOTICE '========================================';
END $;
