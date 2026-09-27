-- Destino de la mercaderia que vuelve en un caso de posventa.
--
-- Completar un cambio o una devolucion movia la plata pero no el producto: la
-- unidad que el cliente devolvia quedaba fuera del sistema, y el stock seguia
-- mostrando una unidad menos de la que habia fisicamente.
--
-- No todo lo que vuelve puede revenderse, asi que el destino es explicito:
--   sellable   -> reingresa al stock vendible
--   quarantine -> vuelve pero con falla; no se revende
--   none       -> no vuelve nada (el cliente se quedo el producto)
--
-- La cuarentena no necesita tabla propia: el caso ya guarda producto y
-- cantidad, asi que el stock con falla es la suma de los casos completados con
-- restock_action = 'quarantine'.

BEGIN;

ALTER TABLE public.after_sales_cases
  ADD COLUMN IF NOT EXISTS restock_action TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'after_sales_cases_restock_action_check'
  ) THEN
    ALTER TABLE public.after_sales_cases
      ADD CONSTRAINT after_sales_cases_restock_action_check
      CHECK (restock_action IS NULL OR restock_action IN ('sellable', 'quarantine', 'none'));
  END IF;
END $$;

COMMENT ON COLUMN public.after_sales_cases.restock_action IS
  'Destino de la mercaderia devuelta: sellable reingresa al stock, quarantine vuelve con falla, none no vuelve nada.';

-- Para responder "cuanta mercaderia con falla tengo" sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_after_sales_quarantine
  ON public.after_sales_cases(organization_id, product_id)
  WHERE restock_action = 'quarantine' AND status = 'completed';

COMMIT;
