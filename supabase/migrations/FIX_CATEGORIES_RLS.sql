-- ============================================================================
-- FIX CATEGORIES RLS POLICIES - IDEMPOTENT VERSION
-- ============================================================================
-- This script fixes RLS policies to allow authenticated users to access categories
-- Can be run multiple times safely
-- ============================================================================

-- STEP 1: Drop ALL existing policies (safe if they don't exist)
-- ============================================================================

DO $$ 
BEGIN
    -- Categories table
    DROP POLICY IF EXISTS "Authenticated can view categories" ON public.categories;
    DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
    DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
    DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
    DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
    DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;
    DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;
    
    RAISE NOTICE 'All existing policies for categories dropped successfully';
END $$;

-- ============================================================================
-- STEP 2: Create new policies for CATEGORIES table
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories" 
ON public.categories
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert categories" 
ON public.categories
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories" 
ON public.categories
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories" 
ON public.categories
FOR DELETE 
TO authenticated
USING (true);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ RLS policies for categories updated successfully!';
    RAISE NOTICE 'All authenticated users can now access categories data';
    RAISE NOTICE 'Test by running: SELECT * FROM categories;';
END $$;
