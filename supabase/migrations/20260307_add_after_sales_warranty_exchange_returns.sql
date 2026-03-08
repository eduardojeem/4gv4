-- ============================================================================
-- Post-sale support:
-- - Product warranty configuration
-- - Exchange and return policy configuration
-- - After-sales cases for warranty/exchange/return workflows
-- Fecha: 2026-03-07
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Product fields: warranty, exchange and return configuration
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS warranty_months INTEGER;

    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS warranty_info TEXT;

    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS return_window_days INTEGER;

    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS exchange_window_days INTEGER;

    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS return_policy TEXT;

    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS exchange_policy TEXT;

    UPDATE public.products
    SET
      warranty_months = COALESCE(warranty_months, 0),
      return_window_days = COALESCE(return_window_days, 0),
      exchange_window_days = COALESCE(exchange_window_days, 0)
    WHERE
      warranty_months IS NULL
      OR return_window_days IS NULL
      OR exchange_window_days IS NULL;

    ALTER TABLE public.products
      ALTER COLUMN warranty_months SET DEFAULT 0,
      ALTER COLUMN return_window_days SET DEFAULT 0,
      ALTER COLUMN exchange_window_days SET DEFAULT 0;

    ALTER TABLE public.products
      ALTER COLUMN warranty_months SET NOT NULL,
      ALTER COLUMN return_window_days SET NOT NULL,
      ALTER COLUMN exchange_window_days SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'products_warranty_months_chk'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_warranty_months_chk
        CHECK (warranty_months >= 0 AND warranty_months <= 60);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'products_return_window_days_chk'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_return_window_days_chk
        CHECK (return_window_days >= 0 AND return_window_days <= 90);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'products_exchange_window_days_chk'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_exchange_window_days_chk
        CHECK (exchange_window_days >= 0 AND exchange_window_days <= 90);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_warranty_months
      ON public.products(warranty_months);

    CREATE INDEX IF NOT EXISTS idx_products_return_window_days
      ON public.products(return_window_days);

    CREATE INDEX IF NOT EXISTS idx_products_exchange_window_days
      ON public.products(exchange_window_days);
  END IF;
END $$;

COMMENT ON COLUMN public.products.warranty_months IS
  'Warranty duration in months. 0 means no warranty.';

COMMENT ON COLUMN public.products.warranty_info IS
  'Warranty terms and conditions shown to the customer.';

COMMENT ON COLUMN public.products.return_window_days IS
  'Return period in days after sale. 0 means no returns.';

COMMENT ON COLUMN public.products.exchange_window_days IS
  'Exchange period in days after sale. 0 means no exchanges.';

COMMENT ON COLUMN public.products.return_policy IS
  'Detailed return policy shown to the customer.';

COMMENT ON COLUMN public.products.exchange_policy IS
  'Detailed exchange policy shown to the customer.';

-- ---------------------------------------------------------------------------
-- 2) After-sales cases: repair warranty, product warranty, exchange, return
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.after_sales_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT UNIQUE
    DEFAULT ('ASC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8))),

  source_type TEXT NOT NULL
    CHECK (source_type IN ('repair', 'sale')),

  request_type TEXT NOT NULL
    CHECK (request_type IN ('repair_warranty', 'product_warranty', 'exchange', 'return')),

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'approved', 'rejected', 'completed', 'cancelled')),

  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,

  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason TEXT NOT NULL,
  notes TEXT,
  refund_amount NUMERIC(12, 2),

  approved_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT after_sales_source_reference_chk CHECK (
    (source_type = 'repair' AND repair_id IS NOT NULL)
    OR
    (source_type = 'sale' AND sale_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_status
  ON public.after_sales_cases(status);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_source_type
  ON public.after_sales_cases(source_type);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_customer_id
  ON public.after_sales_cases(customer_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_repair_id
  ON public.after_sales_cases(repair_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_sale_id
  ON public.after_sales_cases(sale_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_created_at
  ON public.after_sales_cases(created_at DESC);

COMMENT ON TABLE public.after_sales_cases IS
  'After-sales cases: repair warranty claims, product warranty claims, exchanges and returns.';

COMMENT ON COLUMN public.after_sales_cases.request_type IS
  'Type of case: repair_warranty, product_warranty, exchange, return.';

COMMENT ON COLUMN public.after_sales_cases.source_type IS
  'Source module for the case: repair or sale.';

-- ---------------------------------------------------------------------------
-- 3) Trigger for updated_at (if helper function exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_after_sales_cases_updated_at ON public.after_sales_cases;

    CREATE TRIGGER update_after_sales_cases_updated_at
      BEFORE UPDATE ON public.after_sales_cases
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.after_sales_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view after sales cases" ON public.after_sales_cases;
CREATE POLICY "Authenticated users can view after sales cases"
  ON public.after_sales_cases
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can create after sales cases" ON public.after_sales_cases;
CREATE POLICY "Authenticated users can create after sales cases"
  ON public.after_sales_cases
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update after sales cases" ON public.after_sales_cases;
CREATE POLICY "Authenticated users can update after sales cases"
  ON public.after_sales_cases
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 5) Verification notices
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_products BOOLEAN;
  has_after_sales_cases BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) INTO has_products;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'after_sales_cases'
  ) INTO has_after_sales_cases;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'POST-SALE SUPPORT MIGRATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'products table found: %', has_products;
  RAISE NOTICE 'after_sales_cases table created: %', has_after_sales_cases;
  RAISE NOTICE '========================================';
END $$;
