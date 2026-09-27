-- ============================================================================
-- FIX PERMISSIVE RLS POLICIES - SECURITY AUDIT 2026-01-14
-- ============================================================================
-- This migration fixes overly permissive RLS policies that allow unrestricted
-- access for INSERT, UPDATE, and DELETE operations.
-- 
-- CRITICAL: This replaces policies with proper role-based access control
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Fix REPAIRS table policies
-- ============================================================================

-- Drop ALL existing policies (permissive and correct ones)
DROP POLICY IF EXISTS "Authenticated users can insert repairs" ON public.repairs;
DROP POLICY IF EXISTS "Authenticated users can update repairs" ON public.repairs;
DROP POLICY IF EXISTS "repairs_insert_staff" ON public.repairs;
DROP POLICY IF EXISTS "repairs_update_assigned_technician" ON public.repairs;

-- Create proper role-based policies
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

-- ============================================================================
-- STEP 2: Fix SUPPLIERS table policies
-- ============================================================================

-- Drop ALL existing policies (permissive and correct ones)
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_admin_manager" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_admin_manager" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete_admin" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_write_admin_manager" ON public.suppliers;

-- Create proper role-based policies for suppliers
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

-- ============================================================================
-- STEP 3: Fix SUPPLIER_PRODUCTS table policies
-- ============================================================================

-- Drop ALL existing policies
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

-- ============================================================================
-- STEP 4: Fix PURCHASE_ORDERS table policies
-- ============================================================================

-- Drop ALL existing policies
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

-- ============================================================================
-- STEP 5: Fix PURCHASE_ORDER_ITEMS table policies
-- ============================================================================

-- Drop ALL existing policies
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

-- ============================================================================
-- STEP 6: Fix INVENTORY_REORDERS table policies
-- ============================================================================

-- Drop ALL existing policies
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

-- ============================================================================
-- STEP 7: Fix CUSTOMERS table policies
-- ============================================================================

-- Drop ALL existing policies (including permissive ones from old migrations)
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_staff" ON public.customers;
DROP POLICY IF EXISTS "customers_update_staff" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_admin" ON public.customers;

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

-- ============================================================================
-- STEP 8: Fix REPAIR_IMAGES table policies
-- ============================================================================

-- Drop ALL existing policies
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

-- ============================================================================
-- STEP 9: Fix CASH_MOVEMENTS table policies
-- ============================================================================

-- Drop ALL existing policies
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

-- ============================================================================
-- VERIFICATION: Log the changes
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ RLS Security Policies Fixed Successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables updated:';
    RAISE NOTICE '  - repairs: INSERT/UPDATE restricted to staff';
    RAISE NOTICE '  - suppliers: INSERT/UPDATE/DELETE restricted to managers/admins';
    RAISE NOTICE '  - supplier_products: ALL operations restricted to managers/admins';
    RAISE NOTICE '  - purchase_orders: ALL operations restricted to managers/admins';
    RAISE NOTICE '  - purchase_order_items: ALL operations restricted to managers/admins';
    RAISE NOTICE '  - inventory_reorders: ALL operations restricted to managers/admins';
    RAISE NOTICE '  - customers: INSERT/UPDATE restricted to staff';
    RAISE NOTICE '  - repair_images: INSERT/UPDATE/DELETE restricted to staff';
    RAISE NOTICE '  - cash_movements: INSERT/UPDATE/DELETE restricted to staff';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  SELECT policies remain permissive (intentional for public read access)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Test in development environment';
    RAISE NOTICE '  2. Verify user permissions work correctly';
    RAISE NOTICE '  3. Check application functionality';
END $$;

COMMIT;
