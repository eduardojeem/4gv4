-- ============================================================================
-- Restore secure RLS for products, alerts and movements (undo emergency allow-all)
-- Fecha: 2026-03-10
-- ============================================================================
DO $$
BEGIN
  -- PRODUCTS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products'
  ) THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Allow All Auth Products" ON public.products;
  DROP POLICY IF EXISTS "Allow Public Read Products" ON public.products;

  -- Ensure RLS enabled
  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

  -- Public (anon) can only read active public products
  CREATE POLICY "Public read active products" ON public.products
  FOR SELECT
  TO anon
  USING (is_active = true AND visibility = 'public');

  -- Authenticated can read active products (public or wholesale)
  CREATE POLICY "Auth read active products" ON public.products
  FOR SELECT
  TO authenticated
  USING (is_active = true);

  -- Staff manage products
  CREATE POLICY "Staff manage products" ON public.products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    )
  );

  -- PRODUCT ALERTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_alerts') THEN
    DROP POLICY IF EXISTS "Allow All Auth Alerts" ON public.product_alerts;
    ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Auth read alerts" ON public.product_alerts
    FOR SELECT TO authenticated USING (true);

    CREATE POLICY "Staff manage alerts" ON public.product_alerts
    FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    ));
  END IF;

  -- PRODUCT MOVEMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_movements') THEN
    DROP POLICY IF EXISTS "Allow All Auth Movements" ON public.product_movements;
    ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Staff read movements" ON public.product_movements
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    ));

    CREATE POLICY "Staff manage movements" ON public.product_movements
    FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','vendedor','tecnico')
        AND (ur.is_active IS NULL OR ur.is_active = true)
    ));
  END IF;
END $$;
