
-- Fix RLS performance and recursion issues on products table
-- We replace table-querying policies with JWT-claim based policies
-- This prevents infinite recursion and improves performance significantly

BEGIN;

-- 0. Ensure helper function exists (in case previous migration failed)
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    'cliente' -- Default role if not found
  )::text;
$$;

-- 1. Enable RLS (ensure it's on)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing potentially problematic policies
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can select products" ON public.products;
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.products;
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
DROP POLICY IF EXISTS "Staff can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;


-- 3. Create optimized policies using JWT claims (no DB lookups)

-- SELECT: Allow public read (or authenticated depending on requirements, but public read is usually safe for products)
CREATE POLICY "Public can read products"
ON public.products
FOR SELECT
USING (true);

-- INSERT: Only admins/managers/technicians/sellers
CREATE POLICY "Staff can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

-- UPDATE: Only admins/managers/technicians/sellers
CREATE POLICY "Staff can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
)
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

-- DELETE: Only admins/managers
CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager')
);

-- 4. Fix product_alerts policies as well (often a source of blocking if trigger inserts here)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.product_alerts;
DROP POLICY IF EXISTS "Staff can view alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Staff (and triggers) can insert alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Staff can update alerts" ON public.product_alerts;

CREATE POLICY "Staff can view alerts"
ON public.product_alerts
FOR SELECT
TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

CREATE POLICY "Staff (and triggers) can insert alerts"
ON public.product_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  -- Triggers run as the user, so the user needs insert permission.
  -- Usually all staff should be able to generate alerts via triggers.
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

CREATE POLICY "Staff can update alerts"
ON public.product_alerts
FOR UPDATE
TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

-- 5. Fix product_movements policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.product_movements;
DROP POLICY IF EXISTS "Staff can view movements" ON public.product_movements;
DROP POLICY IF EXISTS "Staff (and triggers) can insert movements" ON public.product_movements;

CREATE POLICY "Staff can view movements"
ON public.product_movements
FOR SELECT
TO authenticated
USING (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

CREATE POLICY "Staff (and triggers) can insert movements"
ON public.product_movements
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_jwt_role() IN ('admin', 'super_admin', 'manager', 'technician', 'vendedor')
);

COMMIT;
