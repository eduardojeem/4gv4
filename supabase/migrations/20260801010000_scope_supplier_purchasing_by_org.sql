-- Aisla por organizacion el circuito de compras a proveedores.
--
-- `suppliers` fue acotada en 20260601009000_settings_catalog_tenant_rls.sql,
-- pero supplier_products, purchase_orders, purchase_order_items e
-- inventory_reorders quedaron fuera: no tienen organization_id y conservan la
-- politica original `USING (auth.role() = 'authenticated')`, que deja las
-- ordenes de compra —proveedores, cantidades y precios de compra— visibles
-- para cualquier usuario autenticado de cualquier otra organizacion.
--
-- Ademas purchase_orders.orderNumber es UNIQUE global, asi que dos
-- organizaciones no pueden usar la misma numeracion.

BEGIN;

-- ── 1. Columna organization_id ───────────────────────────────────────────────

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_reorders
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── 2. Backfill desde el proveedor, que ya esta acotado ──────────────────────

UPDATE public.supplier_products sp
SET organization_id = s.organization_id
FROM public.suppliers s
WHERE sp.supplier_id = s.id
  AND sp.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

UPDATE public.purchase_orders po
SET organization_id = s.organization_id
FROM public.suppliers s
WHERE po."supplierid" = s.id
  AND po.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

UPDATE public.purchase_order_items poi
SET organization_id = po.organization_id
FROM public.purchase_orders po
WHERE poi.order_id = po.id
  AND poi.organization_id IS NULL
  AND po.organization_id IS NOT NULL;

-- inventory_reorders puede referenciar al proveedor con distinto nombre de
-- columna segun la instalacion; se resuelve solo si la referencia existe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_reorders'
      AND column_name = 'supplierid'
  ) THEN
    EXECUTE $sql$
      UPDATE public.inventory_reorders ir
      SET organization_id = s.organization_id
      FROM public.suppliers s
      WHERE ir."supplierid" = s.id
        AND ir.organization_id IS NULL
        AND s.organization_id IS NOT NULL
    $sql$;
  END IF;
END $$;

-- ── 3. Indices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_supplier_products_org ON public.supplier_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON public.purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_org ON public.purchase_order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reorders_org ON public.inventory_reorders(organization_id);

-- ── 4. Numeracion de orden unica POR organizacion ────────────────────────────
-- El UNIQUE global impedia que dos organizaciones usaran la misma numeracion.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'purchase_orders'
    AND con.contype = 'u'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.purchase_orders DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_org_number
  ON public.purchase_orders(organization_id, "ordernumber");

-- ── 5. RLS por organizacion ──────────────────────────────────────────────────

DO $$
DECLARE
  target TEXT;
  pol RECORD;
BEGIN
  FOREACH target IN ARRAY ARRAY['supplier_products', 'purchase_orders', 'purchase_order_items', 'inventory_reorders']
  LOOP
    -- Quitar las politicas permisivas heredadas.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, target);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);

    EXECUTE format($f$
      CREATE POLICY "tenant members can read %1$s"
      ON public.%1$I
      FOR SELECT
      USING (public.has_org_permission(organization_id, 'inventory.products.read'))
    $f$, target);

    EXECUTE format($f$
      CREATE POLICY "tenant members can create %1$s"
      ON public.%1$I
      FOR INSERT
      WITH CHECK (public.has_org_permission(organization_id, 'inventory.products.create'))
    $f$, target);

    EXECUTE format($f$
      CREATE POLICY "tenant members can update %1$s"
      ON public.%1$I
      FOR UPDATE
      USING (public.has_org_permission(organization_id, 'inventory.products.update'))
      WITH CHECK (public.has_org_permission(organization_id, 'inventory.products.update'))
    $f$, target);

    EXECUTE format($f$
      CREATE POLICY "tenant members can delete %1$s"
      ON public.%1$I
      FOR DELETE
      USING (public.has_org_permission(organization_id, 'inventory.products.delete'))
    $f$, target);
  END LOOP;
END $$;

COMMIT;
