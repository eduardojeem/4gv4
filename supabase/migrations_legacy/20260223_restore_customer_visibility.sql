-- Restore customer visibility
-- Ensure that all authenticated users can view all customers

-- 1. Drop potential restrictive SELECT policies on customers
-- We want to ensure there is exactly one policy for SELECT and it is permissive
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;

-- 2. Create permissive SELECT policy for customers
CREATE POLICY "Enable read access for authenticated users"
ON public.customers
FOR SELECT
TO authenticated
USING (true);

-- 3. Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Visibilidad de clientes restaurada para todos los usuarios autenticados';
END $$;
