
-- EMERGENCY FIX: Simplify permissions and remove potential bottlenecks
-- This migration temporarily relaxes RLS and removes triggers to diagnose/fix the timeout issue.

BEGIN;

-- 1. Reset RLS on Products to be fully permissive for authenticated users
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
DROP POLICY IF EXISTS "Staff can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can select products" ON public.products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.products;

CREATE POLICY "Allow All Auth Products" 
ON public.products 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow Public Read Products" 
ON public.products 
FOR SELECT 
USING (true);

-- 2. Reset RLS on Product Alerts
DROP POLICY IF EXISTS "Staff can view alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Staff (and triggers) can insert alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Staff can update alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.product_alerts;

CREATE POLICY "Allow All Auth Alerts" 
ON public.product_alerts 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Reset RLS on Product Movements
DROP POLICY IF EXISTS "Staff can view movements" ON public.product_movements;
DROP POLICY IF EXISTS "Staff (and triggers) can insert movements" ON public.product_movements;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.product_movements;

CREATE POLICY "Allow All Auth Movements" 
ON public.product_movements 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Temporarily disable complex triggers that might be locking or looping
-- We will re-enable them one by one after confirming the save works.
DROP TRIGGER IF EXISTS check_product_stock ON public.products;
DROP TRIGGER IF EXISTS auto_create_stock_movement ON public.products;

COMMIT;
