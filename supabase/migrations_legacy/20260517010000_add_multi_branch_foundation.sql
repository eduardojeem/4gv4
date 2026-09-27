-- ============================================================================
-- Multi-branch foundation for POS / inventory / repairs
-- Fecha: 2026-05-17
-- Objetivo:
--   - crear sucursales canónicas
--   - asignar usuarios a sucursales
--   - propagar branch_id a tablas operativas críticas
--   - preparar stock por sucursal sin romper el stock global actual
--   - agregar políticas restrictivas para segmentación por sucursal
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Helpers básicos
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_multi_branch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Tabla canónica de sucursales
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  manager_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_single_default
  ON public.branches(is_default)
  WHERE is_default = TRUE;

CREATE OR REPLACE FUNCTION public.normalize_branch_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.branches
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE id <> NEW.id
      AND is_default = TRUE;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branches_normalize_defaults ON public.branches;
CREATE TRIGGER trg_branches_normalize_defaults
  BEFORE INSERT OR UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_branch_defaults();

INSERT INTO public.branches (code, name, slug, is_active, is_default)
SELECT 'principal', 'Casa Central', 'principal', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.branches);

WITH first_branch AS (
  SELECT id
  FROM public.branches
  ORDER BY is_active DESC, created_at ASC
  LIMIT 1
)
UPDATE public.branches
SET is_default = TRUE,
    updated_at = NOW()
WHERE id = (SELECT id FROM first_branch)
  AND NOT EXISTS (
    SELECT 1 FROM public.branches WHERE is_default = TRUE
  );

CREATE OR REPLACE FUNCTION public.get_default_branch_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT id
  INTO v_branch_id
  FROM public.branches
  WHERE is_default = TRUE
  ORDER BY updated_at DESC, created_at ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    SELECT id
    INTO v_branch_id
    FROM public.branches
    WHERE is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_branch_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Asignaciones usuario <-> sucursal
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_assignments_user
  ON public.user_branch_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_assignments_branch
  ON public.user_branch_assignments(branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_branch_assignments_primary
  ON public.user_branch_assignments(user_id)
  WHERE is_primary = TRUE AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.normalize_primary_branch_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary AND NEW.is_active THEN
    UPDATE public.user_branch_assignments
    SET is_primary = FALSE,
        updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND is_primary = TRUE;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_branch_assignments_primary ON public.user_branch_assignments;
CREATE TRIGGER trg_user_branch_assignments_primary
  BEFORE INSERT OR UPDATE ON public.user_branch_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_primary_branch_assignment();

INSERT INTO public.user_branch_assignments (user_id, branch_id, is_primary, is_active, assigned_by)
SELECT p.id, public.get_default_branch_id(), TRUE, TRUE, p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_branch_assignments uba
  WHERE uba.user_id = p.id
)
ON CONFLICT (user_id, branch_id) DO UPDATE
SET is_active = TRUE;

CREATE OR REPLACE FUNCTION public.get_primary_branch_id(user_uuid UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT branch_id
  INTO v_branch_id
  FROM public.user_branch_assignments
  WHERE user_id = user_uuid
    AND is_active = TRUE
    AND is_primary = TRUE
  ORDER BY updated_at DESC, created_at ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    SELECT branch_id
    INTO v_branch_id
    FROM public.user_branch_assignments
    WHERE user_id = user_uuid
      AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_branch_id, public.get_default_branch_id());
END;
$$;

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
BEGIN
  IF target_branch_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_role := public.get_user_role(user_uuid);
  IF v_role = 'super_admin' THEN
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

-- ----------------------------------------------------------------------------
-- Stock por sucursal compatible con stock global existente
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_inventory (
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_product
  ON public.branch_inventory(product_id);

DROP TRIGGER IF EXISTS trg_branch_inventory_updated_at ON public.branch_inventory;
CREATE TRIGGER trg_branch_inventory_updated_at
  BEFORE UPDATE ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_multi_branch_updated_at();

INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity)
SELECT public.get_default_branch_id(), p.id, COALESCE(p.stock_quantity, 0)
FROM public.products p
ON CONFLICT (branch_id, product_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_product_stock_from_branch_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET stock_quantity = COALESCE((
    SELECT SUM(bi.stock_quantity)
    FROM public.branch_inventory bi
    WHERE bi.product_id = v_product_id
  ), 0),
      updated_at = NOW()
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_inventory_refresh_product_stock ON public.branch_inventory;
CREATE TRIGGER trg_branch_inventory_refresh_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_product_stock_from_branch_inventory();

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
  FROM public.branches
  WHERE is_active = TRUE;

  IF v_active_branch_count <= 1 AND NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    v_default_branch_id := public.get_default_branch_id();

    INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity)
    VALUES (v_default_branch_id, NEW.id, COALESCE(NEW.stock_quantity, 0))
    ON CONFLICT (branch_id, product_id)
    DO UPDATE
    SET stock_quantity = EXCLUDED.stock_quantity,
        updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_default_branch_inventory ON public.products;
CREATE TRIGGER trg_products_sync_default_branch_inventory
  AFTER UPDATE OF stock_quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_default_branch_inventory_from_product_stock();

CREATE OR REPLACE FUNCTION public.seed_default_branch_inventory_for_new_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity)
  VALUES (public.get_default_branch_id(), NEW.id, COALESCE(NEW.stock_quantity, 0))
  ON CONFLICT (branch_id, product_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_seed_default_branch_inventory ON public.products;
CREATE TRIGGER trg_products_seed_default_branch_inventory
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_branch_inventory_for_new_product();

-- ----------------------------------------------------------------------------
-- branch_id en tablas operativas críticas
-- Fix: si branch_id ya existe como TEXT (de migraciones anteriores), convertir a UUID
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- cash_closures: branch_id might be TEXT from earlier migration
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_closures'
      AND column_name = 'branch_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.cash_closures DROP COLUMN branch_id;
  END IF;

  -- cash_movements: branch_id might be TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_movements'
      AND column_name = 'branch_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.cash_movements DROP COLUMN branch_id;
  END IF;

  -- cash_registers: branch_id might be TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_registers'
      AND column_name = 'branch_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.cash_registers DROP COLUMN branch_id;
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.sales
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.repairs
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.cash_registers
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.cash_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.cash_closures
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.product_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.audit_log
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_repairs_branch_id ON public.repairs(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_branch_id ON public.cash_registers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_branch_id ON public.cash_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_branch_id ON public.cash_closures(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_branch_id ON public.product_movements(branch_id);

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_branch_id ON public.audit_log(branch_id)';
  END IF;
END;
$$;

UPDATE public.sales
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

UPDATE public.repairs
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

UPDATE public.cash_registers
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

UPDATE public.cash_movements cm
SET branch_id = COALESCE(cr.branch_id, public.get_default_branch_id())
FROM public.cash_registers cr
WHERE cm.register_id::text = cr.id::text
  AND cm.branch_id IS NULL;

UPDATE public.cash_movements
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

UPDATE public.cash_closures cc
SET branch_id = COALESCE(cr.branch_id, public.get_default_branch_id())
FROM public.cash_registers cr
WHERE cc.register_id::text = cr.id::text
  AND cc.branch_id IS NULL;

UPDATE public.cash_closures
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

UPDATE public.product_movements
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.audit_log SET branch_id = %L::uuid WHERE branch_id IS NULL',
      public.get_default_branch_id()::text
    );
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.sales
  ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();
ALTER TABLE IF EXISTS public.repairs
  ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();
ALTER TABLE IF EXISTS public.cash_registers
  ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();
ALTER TABLE IF EXISTS public.cash_movements
  ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();
ALTER TABLE IF EXISTS public.cash_closures
  ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();
ALTER TABLE IF EXISTS public.product_movements
  ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.audit_log ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id()';
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.sales
  ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE IF EXISTS public.repairs
  ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE IF EXISTS public.cash_registers
  ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE IF EXISTS public.cash_movements
  ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE IF EXISTS public.cash_closures
  ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE IF EXISTS public.product_movements
  ALTER COLUMN branch_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- RLS en sucursales y segmentación restrictiva para tablas críticas
-- ----------------------------------------------------------------------------

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_read_scoped ON public.branches;
CREATE POLICY branches_read_scoped
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('settings.read')
    OR public.user_has_branch_access(id)
  );

DROP POLICY IF EXISTS branches_manage_admin ON public.branches;
CREATE POLICY branches_manage_admin
  ON public.branches
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('settings.update')
    OR public.has_permission('users.manage')
  )
  WITH CHECK (
    public.has_permission('settings.update')
    OR public.has_permission('users.manage')
  );

DROP POLICY IF EXISTS user_branch_assignments_read_scoped ON public.user_branch_assignments;
CREATE POLICY user_branch_assignments_read_scoped
  ON public.user_branch_assignments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission('users.read')
    OR public.has_permission('settings.read')
  );

DROP POLICY IF EXISTS user_branch_assignments_manage_admin ON public.user_branch_assignments;
CREATE POLICY user_branch_assignments_manage_admin
  ON public.user_branch_assignments
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('users.manage')
    OR public.has_permission('settings.update')
  )
  WITH CHECK (
    public.has_permission('users.manage')
    OR public.has_permission('settings.update')
  );

DROP POLICY IF EXISTS branch_inventory_scope ON public.branch_inventory;
CREATE POLICY branch_inventory_scope
  ON public.branch_inventory
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DROP POLICY IF EXISTS sales_branch_scope ON public.sales;
CREATE POLICY sales_branch_scope
  ON public.sales
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DROP POLICY IF EXISTS repairs_branch_scope ON public.repairs;
CREATE POLICY repairs_branch_scope
  ON public.repairs
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DROP POLICY IF EXISTS cash_registers_branch_scope ON public.cash_registers;
CREATE POLICY cash_registers_branch_scope
  ON public.cash_registers
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DROP POLICY IF EXISTS cash_movements_branch_scope ON public.cash_movements;
CREATE POLICY cash_movements_branch_scope
  ON public.cash_movements
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DROP POLICY IF EXISTS cash_closures_branch_scope ON public.cash_closures;
CREATE POLICY cash_closures_branch_scope
  ON public.cash_closures
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DROP POLICY IF EXISTS product_movements_branch_scope ON public.product_movements;
CREATE POLICY product_movements_branch_scope
  ON public.product_movements
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.user_has_branch_access(branch_id))
  WITH CHECK (public.user_has_branch_access(branch_id));

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS audit_log_branch_scope ON public.audit_log';
    EXECUTE $policy$
      CREATE POLICY audit_log_branch_scope
        ON public.audit_log
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          branch_id IS NULL
          OR public.user_has_branch_access(branch_id)
          OR public.has_permission('settings.read')
        )
    $policy$;
  END IF;
END;
$$;
