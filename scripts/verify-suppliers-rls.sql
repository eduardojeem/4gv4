-- Verification script for suppliers RLS policies
-- Run this to check that the new role-based policies are working correctly

-- 1. Check current RLS status for suppliers table
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'suppliers';

-- 2. List all active policies for suppliers table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as "USING clause",
    with_check as "WITH CHECK clause"
FROM pg_policies
WHERE tablename = 'suppliers'
ORDER BY policyname;

-- 3. Check for overly permissive policies (should return no results after fix)
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    'OVERLY PERMISSIVE - USING (true) for ' || cmd as warning
FROM pg_policies
WHERE tablename = 'suppliers'
AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
AND (qual = 'true' OR with_check = 'true')
ORDER BY policyname;

-- 4. Check related tables policies
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN (qual = 'true' OR with_check = 'true') AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') 
        THEN 'OVERLY PERMISSIVE'
        ELSE 'OK'
    END as security_status
FROM pg_policies
WHERE tablename IN ('supplier_products', 'purchase_orders')
ORDER BY tablename, policyname;

-- 5. Check user roles distribution
SELECT 
    role,
    COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 6. Test policy effectiveness (requires actual user context)
-- This section shows what queries would test the policies
/*
-- These queries should be run in the context of different user roles:

-- As admin user:
SELECT 'Admin can view suppliers' as test, COUNT(*) as supplier_count FROM public.suppliers;
INSERT INTO public.suppliers (name, contact_email) VALUES ('Test Supplier Admin', 'admin@test.com');

-- As vendedor user:
SELECT 'Vendedor can view suppliers' as test, COUNT(*) as supplier_count FROM public.suppliers;
INSERT INTO public.suppliers (name, contact_email) VALUES ('Test Supplier Vendedor', 'vendedor@test.com');

-- As tecnico user (should fail for INSERT):
SELECT 'Tecnico can view suppliers' as test, COUNT(*) as supplier_count FROM public.suppliers;
-- This should fail:
-- INSERT INTO public.suppliers (name, contact_email) VALUES ('Test Supplier Tecnico', 'tecnico@test.com');

-- As cliente user (should fail for INSERT):
SELECT 'Cliente can view suppliers' as test, COUNT(*) as supplier_count FROM public.suppliers;
-- This should fail:
-- INSERT INTO public.suppliers (name, contact_email) VALUES ('Test Supplier Cliente', 'cliente@test.com');
*/