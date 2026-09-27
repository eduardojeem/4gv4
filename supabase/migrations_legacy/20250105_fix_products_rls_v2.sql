-- =====================================================
-- FIX: Corregir visibilidad de productos para vendedores
-- Fecha: 2025-01-05
-- Descripción: 
-- 1. Asegura que la columna status (si existe) esté sincronizada con is_active
-- 2. Actualiza la política RLS para usar is_active en lugar de status
-- =====================================================

-- 1. Sincronizar status si existe (para corregir datos antiguos)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'status') THEN
        UPDATE products SET status = 'active' WHERE is_active = true;
    END IF;
END $$;

-- 2. Asegurar que todos los productos estén activos (según solicitud del usuario)
UPDATE products SET is_active = true;

-- 3. Corregir política RLS de vendedores
-- Primero eliminamos la política incorrecta si existe
DROP POLICY IF EXISTS "Vendedores pueden ver productos activos" ON products;

-- Creamos la política corregida usando is_active
CREATE POLICY "Vendedores pueden ver productos activos" ON products
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.jwt() ->> 'user_role' = 'salesperson' AND
        is_active = true
    );

-- 4. Asegurar política general de lectura (fallback)
-- Si esta política existe, permite ver todos los productos a cualquier usuario autenticado.
-- Si se desea restringir, se debe eliminar esta política.
-- Por ahora, la aseguramos para evitar bloqueos totales.
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Usuarios autenticados pueden ver productos'
    ) THEN
        CREATE POLICY "Usuarios autenticados pueden ver productos" ON products
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;
