-- Habilitar RLS en todas las tablas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para categorías
CREATE POLICY "Usuarios autenticados pueden ver categorías" ON categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Solo administradores e inventario pueden modificar categorías" ON categories
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager')
        )
    );

-- Políticas para proveedores
CREATE POLICY "Usuarios autenticados pueden ver proveedores" ON suppliers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Solo administradores e inventario pueden modificar proveedores" ON suppliers
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager')
        )
    );

-- Políticas para productos
CREATE POLICY "Usuarios autenticados pueden ver productos" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Técnicos pueden ver productos" ON products
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'user_role' = 'technician'
    );

CREATE POLICY "Vendedores pueden ver productos activos" ON products
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'user_role' = 'salesperson' AND
        status = 'active'
    );

CREATE POLICY "Inventario puede modificar productos" ON products
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager')
        )
    );

CREATE POLICY "Vendedores pueden actualizar stock en ventas" ON products
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'user_role' = 'salesperson'
    );

-- Políticas para movimientos de productos
CREATE POLICY "Usuarios autenticados pueden ver movimientos" ON product_movements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sistema puede crear movimientos automáticos" ON product_movements
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Inventario puede crear movimientos manuales" ON product_movements
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager')
        )
    );

-- Políticas para historial de precios
CREATE POLICY "Usuarios autenticados pueden ver historial de precios" ON product_price_history
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sistema puede crear historial automático" ON product_price_history
    FOR INSERT WITH CHECK (true);

-- Políticas para alertas
CREATE POLICY "Usuarios autenticados pueden ver alertas" ON product_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sistema puede crear alertas automáticas" ON product_alerts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Inventario puede resolver alertas" ON product_alerts
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager')
        )
    );

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN auth.jwt() ->> 'user_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar permisos de inventario
CREATE OR REPLACE FUNCTION has_inventory_permission()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.role() = 'authenticated' AND 
           get_user_role() IN ('admin', 'inventory_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar permisos de venta
CREATE OR REPLACE FUNCTION has_sales_permission()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.role() = 'authenticated' AND 
           get_user_role() IN ('admin', 'inventory_manager', 'salesperson');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;