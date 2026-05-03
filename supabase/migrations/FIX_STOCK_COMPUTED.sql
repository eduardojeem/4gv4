
-- Cleanup partial state
DROP INDEX IF EXISTS public.idx_products_stock_status;
ALTER TABLE public.products DROP COLUMN IF EXISTS stock_status_computed;

-- Create computed column
ALTER TABLE public.products 
ADD COLUMN stock_status_computed text 
GENERATED ALWAYS AS (
  CASE 
    WHEN stock_quantity = 0 THEN 'out_of_stock'
    WHEN stock_quantity <= min_stock THEN 'low_stock'
    ELSE 'in_stock'
  END
) STORED;

-- Create index
CREATE INDEX idx_products_stock_status ON public.products(stock_status_computed);
