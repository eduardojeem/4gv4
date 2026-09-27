
-- Ensure authenticated users can manage products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

-- Create comprehensive policies for authenticated users
CREATE POLICY "Authenticated users can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
ON public.products FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
ON public.products FOR DELETE TO authenticated
USING (true);

-- Ensure public read access (already done but good to reinforce)
DROP POLICY IF EXISTS "Public can read products" ON public.products;
CREATE POLICY "Public can read products"
ON public.products FOR SELECT
USING (true);
