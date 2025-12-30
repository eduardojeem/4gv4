-- Fix RLS policies for suppliers to allow authenticated users to manage them
-- This is necessary if the admin role is not correctly assigned or if we want to allow all staff to manage suppliers

BEGIN;

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;

-- Create new permissive policy
-- Note: We use IF NOT EXISTS to avoid errors if run multiple times, 
-- but CREATE POLICY doesn't support IF NOT EXISTS in all versions, so we check first.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'suppliers' 
    AND policyname = 'Authenticated can manage suppliers'
  ) THEN
    CREATE POLICY "Authenticated can manage suppliers" ON public.suppliers
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Do the same for related tables to avoid foreign key issues during cascade deletes/updates

-- supplier_products
DROP POLICY IF EXISTS "Admins can manage supplier_products" ON public.supplier_products;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'supplier_products' 
    AND policyname = 'Authenticated can manage supplier_products'
  ) THEN
    CREATE POLICY "Authenticated can manage supplier_products" ON public.supplier_products
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- purchase_orders
DROP POLICY IF EXISTS "Admins can manage purchase_orders" ON public.purchase_orders;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'purchase_orders' 
    AND policyname = 'Authenticated can manage purchase_orders'
  ) THEN
    CREATE POLICY "Authenticated can manage purchase_orders" ON public.purchase_orders
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMIT;
