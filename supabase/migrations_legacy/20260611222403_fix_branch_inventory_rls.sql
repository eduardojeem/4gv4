-- branch_inventory_scope is intentionally restrictive so every operation is
-- limited to branches assigned to the user. PostgreSQL also requires at least
-- one permissive policy; without one, all authenticated operations are denied.

ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(
  target_branch_id UUID,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_organization_id UUID;
  v_org_role public.organization_role;
BEGIN
  IF target_branch_id IS NULL OR user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  v_role := public.get_user_role(user_uuid);
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  SELECT organization_id
  INTO v_organization_id
  FROM public.branches
  WHERE id = target_branch_id
    AND is_active = TRUE;

  IF v_organization_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT om.role
  INTO v_org_role
  FROM public.organization_members om
  WHERE om.organization_id = v_organization_id
    AND om.user_id = user_uuid
    AND om.status = 'active'
  LIMIT 1;

  IF v_org_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_branch_assignments uba
    WHERE uba.user_id = user_uuid
      AND uba.branch_id = target_branch_id
      AND uba.is_active = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_branch_inventory_tenant_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_organization_id UUID;
  v_product_organization_id UUID;
BEGIN
  SELECT organization_id
  INTO v_branch_organization_id
  FROM public.branches
  WHERE id = NEW.branch_id;

  SELECT organization_id
  INTO v_product_organization_id
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_branch_organization_id IS NOT NULL
     AND v_product_organization_id IS NOT NULL
     AND v_branch_organization_id IS DISTINCT FROM v_product_organization_id THEN
    RAISE EXCEPTION 'La sucursal y el producto pertenecen a organizaciones diferentes.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_inventory_tenant_match ON public.branch_inventory;
CREATE TRIGGER trg_branch_inventory_tenant_match
  BEFORE INSERT OR UPDATE OF branch_id, product_id ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_inventory_tenant_match();

CREATE OR REPLACE FUNCTION public.seed_default_branch_inventory_for_new_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_branch_id UUID;
BEGIN
  SELECT b.id
  INTO v_default_branch_id
  FROM public.branches b
  WHERE b.organization_id = NEW.organization_id
    AND b.is_active = TRUE
  ORDER BY b.is_default DESC, b.created_at ASC
  LIMIT 1;

  IF v_default_branch_id IS NOT NULL THEN
    INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity)
    VALUES (v_default_branch_id, NEW.id, COALESCE(NEW.stock_quantity, 0))
    ON CONFLICT (branch_id, product_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_default_branch_inventory_from_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_branch_count INTEGER;
  v_default_branch_id UUID;
BEGIN
  SELECT COUNT(*)
  INTO v_active_branch_count
  FROM public.branches b
  WHERE b.organization_id = NEW.organization_id
    AND b.is_active = TRUE;

  IF v_active_branch_count <= 1 AND NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    SELECT b.id
    INTO v_default_branch_id
    FROM public.branches b
    WHERE b.organization_id = NEW.organization_id
      AND b.is_active = TRUE
    ORDER BY b.is_default DESC, b.created_at ASC
    LIMIT 1;

    IF v_default_branch_id IS NOT NULL THEN
      INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity)
      VALUES (v_default_branch_id, NEW.id, COALESCE(NEW.stock_quantity, 0))
      ON CONFLICT (branch_id, product_id)
      DO UPDATE
      SET stock_quantity = EXCLUDED.stock_quantity,
          updated_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Remove only impossible tenant links created by the old global-default trigger.
DELETE FROM public.branch_inventory bi
USING public.branches b, public.products p
WHERE bi.branch_id = b.id
  AND bi.product_id = p.id
  AND b.organization_id IS NOT NULL
  AND p.organization_id IS NOT NULL
  AND b.organization_id IS DISTINCT FROM p.organization_id;

DROP POLICY IF EXISTS branch_inventory_select_org_permission ON public.branch_inventory;
CREATE POLICY branch_inventory_select_org_permission
  ON public.branch_inventory
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = branch_inventory.branch_id
        AND public.has_org_permission(b.organization_id, 'inventory.products.read')
    )
  );

DROP POLICY IF EXISTS branch_inventory_insert_org_permission ON public.branch_inventory;
CREATE POLICY branch_inventory_insert_org_permission
  ON public.branch_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = branch_inventory.branch_id
        AND (
          public.has_org_permission(b.organization_id, 'inventory.products.create')
          OR public.has_org_permission(b.organization_id, 'inventory.stock.manage')
        )
    )
  );

DROP POLICY IF EXISTS branch_inventory_update_org_permission ON public.branch_inventory;
CREATE POLICY branch_inventory_update_org_permission
  ON public.branch_inventory
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = branch_inventory.branch_id
        AND (
          public.has_org_permission(b.organization_id, 'inventory.products.update')
          OR public.has_org_permission(b.organization_id, 'inventory.stock.manage')
        )
    )
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = branch_inventory.branch_id
        AND (
          public.has_org_permission(b.organization_id, 'inventory.products.update')
          OR public.has_org_permission(b.organization_id, 'inventory.stock.manage')
        )
    )
  );

DROP POLICY IF EXISTS branch_inventory_delete_org_permission ON public.branch_inventory;
CREATE POLICY branch_inventory_delete_org_permission
  ON public.branch_inventory
  FOR DELETE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = branch_inventory.branch_id
        AND (
          public.has_org_permission(b.organization_id, 'inventory.products.update')
          OR public.has_org_permission(b.organization_id, 'inventory.stock.manage')
        )
    )
  );
