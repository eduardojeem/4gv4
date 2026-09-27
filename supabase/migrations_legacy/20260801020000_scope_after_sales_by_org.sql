-- Acota los casos de posventa (garantias, cambios y devoluciones) por organizacion.
--
-- `after_sales_cases` se creo en 20260307 sin organization_id y con politicas
-- `USING (auth.role() = 'authenticated')`, es decir: cualquier usuario
-- autenticado de cualquier organizacion podria leer y modificar los casos de
-- todas las demas, incluyendo montos de reembolso y datos del cliente.
--
-- La tabla todavia no tiene consumidores en la aplicacion, asi que se acota
-- antes de conectarla en lugar de despues.

BEGIN;

ALTER TABLE public.after_sales_cases
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill desde el origen del caso: la reparacion o la venta ya estan acotadas.
UPDATE public.after_sales_cases c
SET organization_id = r.organization_id
FROM public.repairs r
WHERE c.repair_id = r.id
  AND c.organization_id IS NULL
  AND r.organization_id IS NOT NULL;

UPDATE public.after_sales_cases c
SET organization_id = s.organization_id
FROM public.sales s
WHERE c.sale_id = s.id
  AND c.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

-- Ultimo recurso: por el cliente asociado.
UPDATE public.after_sales_cases c
SET organization_id = cu.organization_id
FROM public.customers cu
WHERE c.customer_id = cu.id
  AND c.organization_id IS NULL
  AND cu.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_org
  ON public.after_sales_cases(organization_id);

CREATE INDEX IF NOT EXISTS idx_after_sales_cases_org_status
  ON public.after_sales_cases(organization_id, status);

-- El numero de caso debe ser unico por organizacion, no global.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT con.conname INTO con_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'after_sales_cases'
    AND con.contype = 'u'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.after_sales_cases DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_after_sales_cases_org_number
  ON public.after_sales_cases(organization_id, case_number);

-- ── RLS por organizacion ─────────────────────────────────────────────────────
-- Se reutiliza el permiso de CRM porque un caso de posventa es atencion al
-- cliente: quien gestiona clientes es quien resuelve garantias y devoluciones.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'after_sales_cases'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.after_sales_cases', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "tenant members can read after sales cases"
  ON public.after_sales_cases
  FOR SELECT
  USING (public.has_org_permission(organization_id, 'crm.customers.read'));

CREATE POLICY "tenant members can create after sales cases"
  ON public.after_sales_cases
  FOR INSERT
  WITH CHECK (public.has_org_permission(organization_id, 'crm.customers.manage'));

CREATE POLICY "tenant members can update after sales cases"
  ON public.after_sales_cases
  FOR UPDATE
  USING (public.has_org_permission(organization_id, 'crm.customers.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.customers.manage'));

COMMIT;
