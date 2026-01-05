-- =====================================================
-- CORRECCIÓN DE PERMISOS DE ESCRITURA (UPDATE/INSERT/DELETE)
-- Fecha: 2025-01-05
-- =====================================================

-- 1. Habilitar RLS (por seguridad)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas restrictivas antiguas en PRODUCTS
DROP POLICY IF EXISTS "Inventario puede modificar productos" ON products;
DROP POLICY IF EXISTS "Users can insert products based on role" ON products;
DROP POLICY IF EXISTS "Users can update products based on role" ON products;
DROP POLICY IF EXISTS "Users can delete products based on role" ON products;
DROP POLICY IF EXISTS "Vendedores pueden actualizar stock en ventas" ON products;

-- 3. Crear políticas PERMISIVAS para PRODUCTS (Authenticated Users)
-- Permite que cualquier usuario logueado gestione productos.
CREATE POLICY "Permitir insertar productos a usuarios autenticados" 
ON products FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir actualizar productos a usuarios autenticados" 
ON products FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir eliminar productos a usuarios autenticados" 
ON products FOR DELETE TO authenticated 
USING (true);

-- 4. Asegurar permisos para TRIGGERS (product_movements)
-- Cuando se actualiza un producto, los triggers intentan insertar movimientos.
DROP POLICY IF EXISTS "Inventario puede crear movimientos manuales" ON product_movements;
DROP POLICY IF EXISTS "Sistema puede crear movimientos automáticos" ON product_movements;

CREATE POLICY "Permitir insertar movimientos a usuarios autenticados" 
ON product_movements FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir ver movimientos a usuarios autenticados" 
ON product_movements FOR SELECT TO authenticated 
USING (true);

-- 5. Asegurar permisos para TRIGGERS (product_alerts)
-- Los triggers también pueden crear alertas.
DROP POLICY IF EXISTS "Sistema puede crear alertas automáticas" ON product_alerts;

CREATE POLICY "Permitir insertar alertas a usuarios autenticados" 
ON product_alerts FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir ver alertas a usuarios autenticados" 
ON product_alerts FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Permitir actualizar alertas a usuarios autenticados" 
ON product_alerts FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

-- 6. Asegurar permisos para stock_movements (por si se usa esta tabla en lugar de product_movements)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_movements') THEN
        ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Permitir insertar stock_movements a usuarios autenticados" ON stock_movements;
        CREATE POLICY "Permitir insertar stock_movements a usuarios autenticados" 
        ON stock_movements FOR INSERT TO authenticated 
        WITH CHECK (true);
        
        DROP POLICY IF EXISTS "Permitir ver stock_movements a usuarios autenticados" ON stock_movements;
        CREATE POLICY "Permitir ver stock_movements a usuarios autenticados" 
        ON stock_movements FOR SELECT TO authenticated 
        USING (true);
    END IF;
END $$;
