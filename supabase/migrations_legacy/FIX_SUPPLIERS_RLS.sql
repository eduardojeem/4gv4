-- ============================================================================
-- FIX SUPPLIERS RLS POLICIES - IDEMPOTENT VERSION
-- ============================================================================
-- This script fixes RLS policies to allow authenticated users to access suppliers
-- Can be run multiple times safely
-- ============================================================================

-- STEP 1: Drop ALL existing policies (safe if they don't exist)
-- ============================================================================

DO $$ 
BEGIN
    -- Suppliers table
    DROP POLICY IF EXISTS "Authenticated can view suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;
    
    -- Supplier products table
    DROP POLICY IF EXISTS "Authenticated can view supplier_products" ON public.supplier_products;
    DROP POLICY IF EXISTS "Admins can manage supplier_products" ON public.supplier_products;
    DROP POLICY IF EXISTS "Authenticated users can view supplier_products" ON public.supplier_products;
    DROP POLICY IF EXISTS "Authenticated users can manage supplier_products" ON public.supplier_products;
    
    -- Purchase orders table
    DROP POLICY IF EXISTS "Authenticated can view purchase_orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "Admins can manage purchase_orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "Authenticated users can view purchase_orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "Authenticated users can manage purchase_orders" ON public.purchase_orders;
    
    -- Purchase order items table
    DROP POLICY IF EXISTS "Authenticated can view purchase_order_items" ON public.purchase_order_items;
    DROP POLICY IF EXISTS "Admins can manage purchase_order_items" ON public.purchase_order_items;
    DROP POLICY IF EXISTS "Authenticated users can view purchase_order_items" ON public.purchase_order_items;
    DROP POLICY IF EXISTS "Authenticated users can manage purchase_order_items" ON public.purchase_order_items;
    
    -- Inventory reorders table
    DROP POLICY IF EXISTS "Authenticated can view inventory_reorders" ON public.inventory_reorders;
    DROP POLICY IF EXISTS "Admins can manage inventory_reorders" ON public.inventory_reorders;
    DROP POLICY IF EXISTS "Authenticated users can view inventory_reorders" ON public.inventory_reorders;
    DROP POLICY IF EXISTS "Authenticated users can manage inventory_reorders" ON public.inventory_reorders;
    
    RAISE NOTICE 'All existing policies dropped successfully';
END $$;

-- ============================================================================
-- STEP 2: Create new policies for SUPPLIERS table
-- ============================================================================

CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert suppliers" 
ON public.suppliers
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers" 
ON public.suppliers
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete suppliers" 
ON public.suppliers
FOR DELETE 
TO authenticated
USING (true);

-- ============================================================================
-- STEP 3: Create new policies for SUPPLIER_PRODUCTS table
-- ============================================================================

CREATE POLICY "Authenticated users can view supplier_products" 
ON public.supplier_products
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage supplier_products" 
ON public.supplier_products
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 4: Create new policies for PURCHASE_ORDERS table
-- ============================================================================

CREATE POLICY "Authenticated users can view purchase_orders" 
ON public.purchase_orders
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage purchase_orders" 
ON public.purchase_orders
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 5: Create new policies for PURCHASE_ORDER_ITEMS table
-- ============================================================================

CREATE POLICY "Authenticated users can view purchase_order_items" 
ON public.purchase_order_items
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage purchase_order_items" 
ON public.purchase_order_items
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 6: Create new policies for INVENTORY_REORDERS table
-- ============================================================================

CREATE POLICY "Authenticated users can view inventory_reorders" 
ON public.inventory_reorders
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage inventory_reorders" 
ON public.inventory_reorders
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ RLS policies updated successfully!';
    RAISE NOTICE 'All authenticated users can now access suppliers data';
    RAISE NOTICE 'Test by running: SELECT * FROM suppliers;';
END $$;
