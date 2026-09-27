-- Enable RLS and policies for suppliers and related tables
BEGIN;

-- Enable RLS
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_reorders ENABLE ROW LEVEL SECURITY;

-- Suppliers policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppliers'
      AND policyname = 'Authenticated can view suppliers'
  ) THEN
    CREATE POLICY "Authenticated can view suppliers" ON public.suppliers
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppliers'
      AND policyname = 'Admins can manage suppliers'
  ) THEN
    CREATE POLICY "Admins can manage suppliers" ON public.suppliers
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Supplier products policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_products'
      AND policyname = 'Authenticated can view supplier_products'
  ) THEN
    CREATE POLICY "Authenticated can view supplier_products" ON public.supplier_products
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_products'
      AND policyname = 'Admins can manage supplier_products'
  ) THEN
    CREATE POLICY "Admins can manage supplier_products" ON public.supplier_products
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Purchase orders policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchase_orders'
      AND policyname = 'Authenticated can view purchase_orders'
  ) THEN
    CREATE POLICY "Authenticated can view purchase_orders" ON public.purchase_orders
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchase_orders'
      AND policyname = 'Admins can manage purchase_orders'
  ) THEN
    CREATE POLICY "Admins can manage purchase_orders" ON public.purchase_orders
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Purchase order items policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchase_order_items'
      AND policyname = 'Authenticated can view purchase_order_items'
  ) THEN
    CREATE POLICY "Authenticated can view purchase_order_items" ON public.purchase_order_items
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchase_order_items'
      AND policyname = 'Admins can manage purchase_order_items'
  ) THEN
    CREATE POLICY "Admins can manage purchase_order_items" ON public.purchase_order_items
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Inventory reorders policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_reorders'
      AND policyname = 'Authenticated can view inventory_reorders'
  ) THEN
    CREATE POLICY "Authenticated can view inventory_reorders" ON public.inventory_reorders
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_reorders'
      AND policyname = 'Admins can manage inventory_reorders'
  ) THEN
    CREATE POLICY "Admins can manage inventory_reorders" ON public.inventory_reorders
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

COMMIT;
