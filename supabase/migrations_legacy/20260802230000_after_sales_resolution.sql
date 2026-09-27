-- Cierra el circuito de posventa: reparaciones de garantia y reintegros.
--
-- Hasta ahora un caso de posventa se abria y se resolvia, pero no producia
-- ningun efecto: quien atendia tenia que crear la reparacion nueva a mano y
-- devolver la plata por fuera del sistema, sin que quedara rastro de que una
-- cosa venia de la otra.

BEGIN;

-- ── Reparacion de garantia ───────────────────────────────────────────────────
-- Autorreferencia: la reparacion rehecha apunta a la original. Ademas de la
-- trazabilidad, habilita la metrica de retrabajo (que porcentaje de
-- reparaciones vuelve, por tecnico y por tipo de falla).

ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS parent_repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repairs_parent
  ON public.repairs(parent_repair_id)
  WHERE parent_repair_id IS NOT NULL;

COMMENT ON COLUMN public.repairs.parent_repair_id IS
  'Reparacion original cuando esta es un retrabajo por garantia. NULL en reparaciones normales.';

-- ── Resolucion del caso ──────────────────────────────────────────────────────

ALTER TABLE public.after_sales_cases
  ADD COLUMN IF NOT EXISTS refund_method TEXT,
  -- Deliberadamente SIN foreign key a repairs: `after_sales_cases.repair_id` ya
  -- referencia esa tabla, y una segunda FK entre el mismo par convierte a
  -- PostgREST en incapaz de resolver los embeds sin hints explicitos. Eso ya
  -- rompio la carga de reparaciones una vez (ver los hints `customers!customer_id`
  -- que hubo que agregar en toda la app). La integridad se sostiene desde la
  -- aplicacion, que es la unica que escribe esta columna.
  ADD COLUMN IF NOT EXISTS generated_repair_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'after_sales_cases_refund_method_check'
  ) THEN
    ALTER TABLE public.after_sales_cases
      ADD CONSTRAINT after_sales_cases_refund_method_check
      CHECK (refund_method IS NULL OR refund_method IN ('cash', 'store_credit'));
  END IF;
END $$;

COMMENT ON COLUMN public.after_sales_cases.refund_method IS
  'Como se devolvio el dinero: cash (sale de caja) o store_credit (saldo a favor).';

-- ── Saldo a favor del cliente ────────────────────────────────────────────────
-- `customer_credits` es financiacion: plata que el cliente DEBE. Esto es lo
-- contrario, plata que la organizacion le debe al cliente, y no existia.
--
-- Se modela como libro mayor y no como un saldo mutable: el saldo es la suma de
-- los movimientos. Asi un reintegro y su consumo quedan ambos auditables, en
-- lugar de un numero que cambia sin explicar por que.

CREATE TABLE IF NOT EXISTS public.customer_store_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  -- Positivo acredita, negativo consume. El saldo nunca puede quedar negativo:
  -- lo valida la aplicacion antes de insertar el consumo.
  amount NUMERIC(14, 2) NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('after_sales', 'sale', 'manual')),
  -- Sin FK por el mismo motivo que generated_repair_id.
  source_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_credits_customer
  ON public.customer_store_credits(organization_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_store_credits_source
  ON public.customer_store_credits(source_type, source_id)
  WHERE source_id IS NOT NULL;

-- Una venta consume saldo una sola vez. Si el POS reintenta el canje tras un
-- corte de red, el segundo intento choca contra el indice en lugar de
-- descontarle el saldo dos veces al cliente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_credits_one_per_sale
  ON public.customer_store_credits(source_id)
  WHERE source_type = 'sale' AND source_id IS NOT NULL;

ALTER TABLE public.customer_store_credits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_store_credits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customer_store_credits', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "tenant members can read store credits"
  ON public.customer_store_credits
  FOR SELECT
  USING (public.has_org_permission(organization_id, 'crm.customers.read'));

CREATE POLICY "tenant members can create store credits"
  ON public.customer_store_credits
  FOR INSERT
  WITH CHECK (public.has_org_permission(organization_id, 'crm.customers.manage'));

-- Sin UPDATE ni DELETE a proposito: un libro mayor se corrige con un asiento
-- inverso, no editando el historial.

COMMIT;
