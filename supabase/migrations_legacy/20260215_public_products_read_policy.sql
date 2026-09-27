-- Ensure public read access to products for the public catalog
-- Safe: only SELECT; write operations remain controlled by existing policies

-- Enable RLS (idempotent)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Remove potential conflicting public read policies
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;

-- Grant public (anon) read for catalog
CREATE POLICY "Public can read products"
  ON public.products
  FOR SELECT
  USING (true);

