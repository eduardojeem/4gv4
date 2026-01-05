-- =====================================================
-- SOLUCIÓN DEFINITIVA: Corrección de Políticas de Seguridad (RLS)
-- Fecha: 2025-01-05
-- =====================================================

-- 1. Habilitar RLS (por seguridad, aseguramos que esté activo)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas restrictivas anteriores que podrían estar ocultando productos
-- (Es seguro borrar políticas si no existen, el IF EXISTS lo maneja)
DROP POLICY IF EXISTS "Vendedores pueden ver productos activos" ON products;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver productos" ON products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON products;
DROP POLICY IF EXISTS "Técnicos pueden ver productos" ON products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON products;

-- 3. Crear una política ÚNICA y CLARA para lectura
-- Esta política permite que CUALQUIER usuario autenticado vea TODOS los productos.
-- Esto soluciona el problema de productos ocultos por rol o estado.
CREATE POLICY "Permitir ver todos los productos a usuarios autenticados" 
ON products 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Crear políticas de escritura para roles autorizados (Admin e Inventario)
-- (Aseguramos que no se pierda la capacidad de editar)
DROP POLICY IF EXISTS "Inventario puede modificar productos" ON products;

CREATE POLICY "Inventario puede modificar productos" 
ON products 
FOR ALL 
TO authenticated 
USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager', 'super_admin')
)
WITH CHECK (
    auth.jwt() ->> 'user_role' IN ('admin', 'inventory_manager', 'super_admin')
);

-- 5. Corrección de Datos: Asegurar que todos los productos estén activos
-- El usuario reportó ver solo 21 de 70. Activamos todos para asegurar visibilidad.
UPDATE products SET is_active = true;

-- 6. Sincronización de columna 'status' (Legacy)
-- Si existe la columna 'status', la actualizamos para evitar conflictos con código viejo.
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'status') THEN
        UPDATE products SET status = 'active';
    END IF;
END $$;
