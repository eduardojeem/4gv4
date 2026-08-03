-- Cambio de producto: que se lleva el cliente en reemplazo.
--
-- El tipo de caso `exchange` existia desde el principio, pero no habia donde
-- guardar POR CUAL producto se cambia. Al completarlo volvia la unidad devuelta
-- al stock y el reemplazo salia por afuera del sistema, como una venta aparte,
-- sin quedar ligado al caso.

BEGIN;

ALTER TABLE public.after_sales_cases
  -- Sin foreign key, por la misma razon que generated_repair_id:
  -- `after_sales_cases.product_id` ya referencia products, y una segunda FK
  -- entre el mismo par vuelve ambiguos los embeds de PostgREST.
  ADD COLUMN IF NOT EXISTS replacement_product_id UUID,
  ADD COLUMN IF NOT EXISTS replacement_quantity INTEGER,
  -- Positivo: el cliente abona la diferencia. Negativo: se le devuelve.
  ADD COLUMN IF NOT EXISTS price_difference NUMERIC(14, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'after_sales_cases_replacement_qty_check'
  ) THEN
    ALTER TABLE public.after_sales_cases
      ADD CONSTRAINT after_sales_cases_replacement_qty_check
      CHECK (replacement_quantity IS NULL OR replacement_quantity > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.after_sales_cases.replacement_product_id IS
  'Producto que se lleva el cliente en un cambio. Sale del stock al completar el caso.';
COMMENT ON COLUMN public.after_sales_cases.price_difference IS
  'Diferencia a favor de la organizacion (positiva) o del cliente (negativa) en un cambio.';

-- Un cambio se resuelve producto por producto, asi que hace falta poder
-- encontrar los casos abiertos de una linea de venta concreta.
CREATE INDEX IF NOT EXISTS idx_after_sales_sale_item
  ON public.after_sales_cases(organization_id, sale_item_id)
  WHERE sale_item_id IS NOT NULL;

COMMIT;
