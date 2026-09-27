-- =====================================================
-- SOLUCIÓN DEFINITIVA PARTE 2: RLS GLOBAL Y VISIBILIDAD (CORREGIDO)
-- Fecha: 2025-01-05
-- =====================================================

-- 1. Habilitar RLS en tablas auxiliares (si no lo está)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 2. CATEGORÍAS: Eliminar restricciones y permitir TODO a usuarios autenticados
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver categorías" ON categories;
DROP POLICY IF EXISTS "Solo administradores e inventario pueden modificar categorías" ON categories;
DROP POLICY IF EXISTS "categories_read_policy" ON categories;
DROP POLICY IF EXISTS "categories_write_policy" ON categories;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON categories;
DROP POLICY IF EXISTS "Authenticated users can view categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;

CREATE POLICY "Permitir todo en categorias a usuarios autenticados" 
ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. PROVEEDORES: Eliminar restricciones y permitir TODO a usuarios autenticados
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver proveedores" ON suppliers;
DROP POLICY IF EXISTS "Solo administradores e inventario pueden modificar proveedores" ON suppliers;
DROP POLICY IF EXISTS "suppliers_read_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_write_policy" ON suppliers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON suppliers;
DROP POLICY IF EXISTS "Authenticated can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated can manage suppliers" ON suppliers;

CREATE POLICY "Permitir todo en proveedores a usuarios autenticados" 
ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. CLIENTES: Eliminar restricciones y permitir TODO a usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can create customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;

CREATE POLICY "Permitir todo en clientes a usuarios autenticados" 
ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Asegurar que las categorías y proveedores estén activos
-- Corregido: categories usa is_active, suppliers usa status

-- Actualizar categorías
UPDATE categories SET is_active = true;

-- Actualizar proveedores (usando status en lugar de is_active)
DO $$ 
BEGIN 
    -- Verificar si existe la columna status (que sabemos que sí, pero por seguridad)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'status') THEN
        UPDATE suppliers SET status = 'active';
    END IF;

    -- Si por alguna razón existiera is_active (migraciones antiguas), actualizarlo también, pero sin fallar si no existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'is_active') THEN
        EXECUTE 'UPDATE suppliers SET is_active = true';
    END IF;
END $$;
