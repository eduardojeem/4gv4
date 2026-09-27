-- ============================================================================
-- Tenant-aware RLS for cash_closures, cash_movements, product_movements
-- cash_movements already has organization_id (added by 20260601000000).
-- cash_closures and product_movements need the column added first.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Add organization_id to tables that the foundation migration missed
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'default' LIMIT 1;

  -- cash_closures
  IF to_regclass('public.cash_closures') IS NOT NULL THEN
    ALTER TABLE public.cash_closures
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
    CREATE INDEX IF NOT EXISTS idx_cash_closures_organization_id ON public.cash_closures(organization_id);
    IF default_org_id IS NOT NULL THEN
      UPDATE public.cash_closures SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
  END IF;

  -- product_movements
  IF to_regclass('public.product_movements') IS NOT NULL THEN
    ALTER TABLE public.product_movements
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
    CREATE INDEX IF NOT EXISTS idx_product_movements_organization_id ON public.product_movements(organization_id);
    IF default_org_id IS NOT NULL THEN
      UPDATE public.product_movements SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- cash_closures RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view closures"   ON public.cash_closures;
DROP POLICY IF EXISTS "Authenticated users can create closures" ON public.cash_closures;
-- cash_closures_branch_scope (RESTRICTIVE) from multi-branch migration stays — narrows further.

CREATE POLICY "tenant members can read cash closures"
ON public.cash_closures
FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  OR public.has_org_permission(organization_id, 'pos.sales.read')
);

CREATE POLICY "tenant members can create cash closures"
ON public.cash_closures
FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, 'pos.cash.manage')
);

CREATE POLICY "tenant members can update cash closures"
ON public.cash_closures
FOR UPDATE TO authenticated
USING  (public.has_org_permission(organization_id, 'pos.cash.manage'))
WITH CHECK (public.has_org_permission(organization_id, 'pos.cash.manage'));

CREATE POLICY "tenant members can delete cash closures"
ON public.cash_closures
FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, 'pos.cash.manage'));

-- ---------------------------------------------------------------------------
-- cash_movements RLS  (organization_id already exists)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated users only" ON public.cash_movements;
DROP POLICY IF EXISTS "Usuarios autenticados ven movimientos"      ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_insert_staff"                ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_update_staff"                ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_delete_admin"                ON public.cash_movements;

CREATE POLICY "tenant members can read cash movements"
ON public.cash_movements
FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  OR public.has_org_permission(organization_id, 'pos.sales.read')
  OR public.has_org_permission(organization_id, 'pos.sales.create')
);

CREATE POLICY "tenant members can create cash movements"
ON public.cash_movements
FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  OR public.has_org_permission(organization_id, 'pos.sales.create')
);

CREATE POLICY "tenant members can update cash movements"
ON public.cash_movements
FOR UPDATE TO authenticated
USING  (public.has_org_permission(organization_id, 'pos.cash.manage'))
WITH CHECK (public.has_org_permission(organization_id, 'pos.cash.manage'));

CREATE POLICY "tenant members can delete cash movements"
ON public.cash_movements
FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, 'pos.cash.manage'));

-- ---------------------------------------------------------------------------
-- product_movements RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver movimientos" ON public.product_movements;
DROP POLICY IF EXISTS "Sistema puede crear movimientos automáticos"  ON public.product_movements;
DROP POLICY IF EXISTS "Inventario puede crear movimientos manuales"  ON public.product_movements;
DROP POLICY IF EXISTS "Allow all for authenticated users"            ON public.product_movements;
DROP POLICY IF EXISTS "Staff read movements"                         ON public.product_movements;
DROP POLICY IF EXISTS "Staff manage movements"                       ON public.product_movements;
-- product_movements_branch_scope (RESTRICTIVE) stays — narrows further.

CREATE POLICY "tenant members can read product movements"
ON public.product_movements
FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, 'inventory.stock.manage')
  OR public.has_org_permission(organization_id, 'inventory.products.read')
);

CREATE POLICY "tenant members can create product movements"
ON public.product_movements
FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, 'inventory.stock.manage')
);

CREATE POLICY "tenant members can update product movements"
ON public.product_movements
FOR UPDATE TO authenticated
USING  (public.has_org_permission(organization_id, 'inventory.stock.manage'))
WITH CHECK (public.has_org_permission(organization_id, 'inventory.stock.manage'));

CREATE POLICY "tenant members can delete product movements"
ON public.product_movements
FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, 'inventory.stock.manage'));

COMMIT;
