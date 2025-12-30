-- ============================================================================
-- INSPECT RLS STATUS
-- ============================================================================
-- Run this script to check the current RLS policies and table permissions
-- ============================================================================

-- 1. Check RLS enablement on tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('categories', 'profiles', 'user_roles', 'suppliers');

-- 2. List all active policies for these tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('categories', 'profiles', 'user_roles', 'suppliers')
ORDER BY tablename, policyname;

SELECT to_regclass('public.categories') IS NOT NULL AS categories_exists;

-- 4. Check your own user profile (will return data only if RLS allows)
SELECT id, email, role FROM profiles WHERE id = auth.uid();

-- 5. Check your user roles (will return data only if RLS allows)
SELECT * FROM user_roles WHERE user_id = auth.uid();
