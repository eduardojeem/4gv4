-- Fix overly permissive RLS policies for suppliers table
-- Replace the current policy that allows unrestricted access with role-based access control

BEGIN;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Permitir todo en proveedores a usuarios autenticados" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.suppliers;

-- Create secure role-based policies

-- 1. Allow all authenticated users to view suppliers (SELECT is often needed for dropdowns, etc.)
CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Only admins and vendedores can insert new suppliers
CREATE POLICY "Admins and vendedores can insert suppliers" 
ON public.suppliers 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
);

-- 3. Only admins and vendedores can update suppliers
CREATE POLICY "Admins and vendedores can update suppliers" 
ON public.suppliers 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
);

-- 4. Only admins can delete suppliers
CREATE POLICY "Only admins can delete suppliers" 
ON public.suppliers 
FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Also fix related tables with similar overly permissive policies

-- supplier_products table
DROP POLICY IF EXISTS "Authenticated can manage supplier_products" ON public.supplier_products;

CREATE POLICY "Authenticated users can view supplier_products" 
ON public.supplier_products 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins and vendedores can manage supplier_products" 
ON public.supplier_products 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
);

-- purchase_orders table
DROP POLICY IF EXISTS "Authenticated can manage purchase_orders" ON public.purchase_orders;

CREATE POLICY "Authenticated users can view purchase_orders" 
ON public.purchase_orders 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins and vendedores can manage purchase_orders" 
ON public.purchase_orders 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'vendedor')
    )
);

COMMIT;