-- =====================================================
-- SCRIPT: RLS Permissions for Categories
-- Feature: Dashboard / Categories
-- Description: Secure access to categories table
-- =====================================================

-- 1. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Allow all operations on categories" ON public.categories;
DROP POLICY IF EXISTS "categories_read_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_write_policy" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

-- 3. Create READ policy (All authenticated users can see categories)
CREATE POLICY "Authenticated users can view categories" 
ON public.categories 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Create WRITE policies (Only Admins and Managers can modify)
-- Roles allowed: admin, super_admin, inventory_manager, manager

-- INSERT
CREATE POLICY "Admins and Managers can insert categories" 
ON public.categories 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
);

-- UPDATE
CREATE POLICY "Admins and Managers can update categories" 
ON public.categories 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
);

-- DELETE
CREATE POLICY "Admins and Managers can delete categories" 
ON public.categories 
FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'inventory_manager', 'manager')
    )
);

-- 5. Notify completion
DO $$ 
BEGIN
    RAISE NOTICE '✅ RLS policies for categories updated successfully!';
    RAISE NOTICE '  - READ: All authenticated users';
    RAISE NOTICE '  - WRITE: Admins, Super Admins, Managers, Inventory Managers';
END $$;
