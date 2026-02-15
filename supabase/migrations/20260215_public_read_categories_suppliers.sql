-- Allow public (anon) read access to categories and suppliers for product catalog embedding

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read categories" ON public.categories;
DROP POLICY IF EXISTS "Public can read suppliers" ON public.suppliers;

CREATE POLICY "Public can read categories"
  ON public.categories
  FOR SELECT
  USING (true);

CREATE POLICY "Public can read suppliers"
  ON public.suppliers
  FOR SELECT
  USING (true);

