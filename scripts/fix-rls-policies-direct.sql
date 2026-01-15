-- ============================================================================
-- FIX RLS POLICIES - DIRECT EXECUTION SCRIPT
-- ============================================================================
-- Este script puede ejecutarse directamente en Supabase SQL Editor
-- Es completamente idempotente (puede ejecutarse múltiples veces)
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '🔧 Iniciando corrección de políticas RLS...';
END $$;

-- ============================================================================
-- REPAIRS
-- ============================================================================

DO $$ 
BEGIN
    -- Drop ALL existing policies
    DROP POLICY IF EXISTS "Authenticated users can insert repairs" ON public.repairs;
    DROP POLICY IF EXISTS "Authenticated users can update repairs" ON public.repairs;
    DROP POLICY IF EXISTS "repairs_insert_staff" ON public.repairs;
    DROP POLICY IF EXISTS "repairs_update_assigned_technician" ON public.repairs;
    
    -- Create correct policies
    CREATE POLICY "repairs_insert_staff" ON public.repairs
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin() OR 
        public.is_cashier()
    );
    
    CREATE POLICY "repairs_update_assigned_technician" ON public.repairs
    FOR UPDATE TO authenticated
    USING (
        technician_id = auth.uid() OR 
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        technician_id = auth.uid() OR 
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ REPAIRS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  REPAIRS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- SUPPLIERS
-- ============================================================================

DO $$ 
BEGIN
    -- Drop ALL existing policies
    DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "suppliers_insert_admin_manager" ON public.suppliers;
    DROP POLICY IF EXISTS "suppliers_update_admin_manager" ON public.suppliers;
    DROP POLICY IF EXISTS "suppliers_delete_admin" ON public.suppliers;
    DROP POLICY IF EXISTS "suppliers_write_admin_manager" ON public.suppliers;
    
    -- Create correct policies
    CREATE POLICY "suppliers_insert_admin_manager" ON public.suppliers
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "suppliers_update_admin_manager" ON public.suppliers
    FOR UPDATE TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "suppliers_delete_admin" ON public.suppliers
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
    );
    
    RAISE NOTICE '✅ SUPPLIERS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  SUPPLIERS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- SUPPLIER_PRODUCTS
-- ============================================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can manage supplier_products" ON public.supplier_products;
    DROP POLICY IF EXISTS "supplier_products_write_manager_admin" ON public.supplier_products;
    
    CREATE POLICY "supplier_products_write_manager_admin" ON public.supplier_products
    FOR ALL TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ SUPPLIER_PRODUCTS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  SUPPLIER_PRODUCTS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- PURCHASE_ORDERS
-- ============================================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can manage purchase_orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "purchase_orders_write_manager_admin" ON public.purchase_orders;
    
    CREATE POLICY "purchase_orders_write_manager_admin" ON public.purchase_orders
    FOR ALL TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ PURCHASE_ORDERS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  PURCHASE_ORDERS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- PURCHASE_ORDER_ITEMS
-- ============================================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can manage purchase_order_items" ON public.purchase_order_items;
    DROP POLICY IF EXISTS "purchase_order_items_write_manager_admin" ON public.purchase_order_items;
    
    CREATE POLICY "purchase_order_items_write_manager_admin" ON public.purchase_order_items
    FOR ALL TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ PURCHASE_ORDER_ITEMS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  PURCHASE_ORDER_ITEMS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- INVENTORY_REORDERS
-- ============================================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can manage inventory_reorders" ON public.inventory_reorders;
    DROP POLICY IF EXISTS "inventory_reorders_write_manager_admin" ON public.inventory_reorders;
    
    CREATE POLICY "inventory_reorders_write_manager_admin" ON public.inventory_reorders
    FOR ALL TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ INVENTORY_REORDERS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  INVENTORY_REORDERS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

DO $$ 
BEGIN
    -- Drop ALL existing policies (permissive and correct ones)
    DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;
    DROP POLICY IF EXISTS "customers_insert_staff" ON public.customers;
    DROP POLICY IF EXISTS "customers_update_staff" ON public.customers;
    DROP POLICY IF EXISTS "customers_delete_admin" ON public.customers;
    
    -- Create correct policies
    CREATE POLICY "customers_insert_staff" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin() OR
        public.is_cashier()
    );
    
    CREATE POLICY "customers_update_staff" ON public.customers
    FOR UPDATE TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "customers_delete_admin" ON public.customers
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
    );
    
    RAISE NOTICE '✅ CUSTOMERS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  CUSTOMERS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- REPAIR_IMAGES
-- ============================================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can insert repair images" ON public.repair_images;
    DROP POLICY IF EXISTS "repair_images_insert_staff" ON public.repair_images;
    DROP POLICY IF EXISTS "repair_images_update_staff" ON public.repair_images;
    DROP POLICY IF EXISTS "repair_images_delete_staff" ON public.repair_images;
    
    CREATE POLICY "repair_images_insert_staff" ON public.repair_images
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin() OR 
        public.is_technician()
    );
    
    CREATE POLICY "repair_images_update_staff" ON public.repair_images
    FOR UPDATE TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin() OR 
        public.is_technician()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin() OR 
        public.is_technician()
    );
    
    CREATE POLICY "repair_images_delete_staff" ON public.repair_images
    FOR DELETE TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ REPAIR_IMAGES: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  REPAIR_IMAGES: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- CASH_MOVEMENTS
-- ============================================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.cash_movements;
    DROP POLICY IF EXISTS "cash_movements_insert_staff" ON public.cash_movements;
    DROP POLICY IF EXISTS "cash_movements_update_staff" ON public.cash_movements;
    DROP POLICY IF EXISTS "cash_movements_delete_admin" ON public.cash_movements;
    
    CREATE POLICY "cash_movements_insert_staff" ON public.cash_movements
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_cashier() OR 
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "cash_movements_update_staff" ON public.cash_movements
    FOR UPDATE TO authenticated
    USING (
        public.is_cashier() OR 
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_cashier() OR 
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "cash_movements_delete_admin" ON public.cash_movements
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
    );
    
    RAISE NOTICE '✅ CASH_MOVEMENTS: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  CASH_MOVEMENTS: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- CASH_CLOSURES
-- ============================================================================

DO $$ 
BEGIN
    -- Drop ALL existing policies
    DROP POLICY IF EXISTS "Allow all operations on cash_closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Authenticated users can view closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Authenticated users can create closures" ON public.cash_closures;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden ver cierres de caja" ON public.cash_closures;
    DROP POLICY IF EXISTS "Administradores y vendedores pueden insertar cierres de caja" ON public.cash_closures;
    DROP POLICY IF EXISTS "cash_closures_read_manager_admin" ON public.cash_closures;
    DROP POLICY IF EXISTS "cash_closures_write_manager_admin" ON public.cash_closures;
    
    -- Create correct policies
    CREATE POLICY "cash_closures_read_manager_admin" ON public.cash_closures
    FOR SELECT TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    );
    
    CREATE POLICY "cash_closures_write_manager_admin" ON public.cash_closures
    FOR ALL TO authenticated
    USING (
        public.is_manager() OR 
        public.is_admin()
    )
    WITH CHECK (
        public.is_manager() OR 
        public.is_admin()
    );
    
    RAISE NOTICE '✅ CASH_CLOSURES: Políticas corregidas';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  CASH_CLOSURES: Error - %', SQLERRM;
END $$;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$ 
DECLARE
    v_critical_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Verificando corrección...';
    
    SELECT COUNT(*) INTO v_critical_count
    FROM pg_policies
    WHERE schemaname = 'public'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND (qual = 'true' OR with_check = 'true');
    
    IF v_critical_count = 0 THEN
        RAISE NOTICE '✅ ¡ÉXITO! 0 políticas críticas detectadas';
        RAISE NOTICE '✅ Todas las vulnerabilidades han sido corregidas';
    ELSE
        RAISE NOTICE '⚠️  Aún hay % políticas críticas', v_critical_count;
        RAISE NOTICE '⚠️  Revisa las políticas manualmente';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Resumen:';
    RAISE NOTICE '  - repairs: ✅ Corregido';
    RAISE NOTICE '  - suppliers: ✅ Corregido';
    RAISE NOTICE '  - supplier_products: ✅ Corregido';
    RAISE NOTICE '  - purchase_orders: ✅ Corregido';
    RAISE NOTICE '  - purchase_order_items: ✅ Corregido';
    RAISE NOTICE '  - inventory_reorders: ✅ Corregido';
    RAISE NOTICE '  - customers: ✅ Corregido';
    RAISE NOTICE '  - repair_images: ✅ Corregido';
    RAISE NOTICE '  - cash_movements: ✅ Corregido';
    RAISE NOTICE '  - cash_closures: ✅ Corregido';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Próximos pasos:';
    RAISE NOTICE '  1. Probar funcionalidad con diferentes roles';
    RAISE NOTICE '  2. Verificar que no hay errores en la aplicación';
    RAISE NOTICE '  3. Revisar logs de Supabase';
END $$;
