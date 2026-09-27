-- Align promotions with the dashboard's promotion-specific permissions.
-- Older schema paths created promotions without code/organization_id, while
-- later tenant RLS expected organization_id and inventory permissions.

DO $$
DECLARE
  default_org_id uuid;
BEGIN
  IF to_regclass('public.promotions') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.promotions
    ADD COLUMN IF NOT EXISTS code text,
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS min_purchase numeric(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_discount numeric(12, 2),
    ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_limit integer,
    ADD COLUMN IF NOT EXISTS applicable_products text[],
    ADD COLUMN IF NOT EXISTS applicable_categories text[],
    ADD COLUMN IF NOT EXISTS start_date timestamp with time zone,
    ADD COLUMN IF NOT EXISTS end_date timestamp with time zone;

  ALTER TABLE public.promotions
    ALTER COLUMN start_date DROP NOT NULL,
    ALTER COLUMN end_date DROP NOT NULL;

  UPDATE public.promotions
  SET code = upper(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9]+', '_', 'g')) || '_' || left(id::text, 8)
  WHERE code IS NULL OR btrim(code) = '';

  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'default'
  LIMIT 1;

  IF default_org_id IS NOT NULL THEN
    UPDATE public.promotions
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
  END IF;
END $$;

WITH normalized AS (
  SELECT
    id,
    upper(regexp_replace(btrim(code), '[^a-zA-Z0-9]+', '_', 'g')) AS normalized_code
  FROM public.promotions
  WHERE code IS NOT NULL
),
deduplicated AS (
  SELECT
    p.id,
    p.organization_id,
    n.normalized_code,
    row_number() OVER (
      PARTITION BY p.organization_id, n.normalized_code
      ORDER BY p.created_at NULLS LAST, p.id
    ) AS duplicate_position
  FROM public.promotions p
  JOIN normalized n ON n.id = p.id
  WHERE p.organization_id IS NOT NULL
    AND n.normalized_code <> ''
)
UPDATE public.promotions p
SET code = CASE
  WHEN d.duplicate_position = 1 THEN d.normalized_code
  ELSE d.normalized_code || '_' || left(p.id::text, 8)
END
FROM deduplicated d
WHERE d.id = p.id;

DROP INDEX IF EXISTS public.idx_promotions_code;

DO $$
DECLARE
  constraint_record record;
BEGIN
  IF to_regclass('public.promotions') IS NULL THEN
    RETURN;
  END IF;

  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.promotions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (code)'
  LOOP
    EXECUTE format('ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_org_code
ON public.promotions(organization_id, code)
WHERE organization_id IS NOT NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_org_active
ON public.promotions(organization_id, is_active);

CREATE OR REPLACE FUNCTION public.has_org_permission(target_organization_id uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  member_role public.organization_role;
BEGIN
  member_role := public.get_org_role(target_organization_id);

  IF member_role IS NULL THEN
    RETURN false;
  END IF;

  IF member_role = 'owner' THEN
    RETURN true;
  END IF;

  IF member_role = 'admin' THEN
    RETURN permission_name <> 'billing.manage';
  END IF;

  IF member_role = 'manager' THEN
    RETURN permission_name = ANY(ARRAY[
      'inventory.products.read',
      'inventory.products.create',
      'inventory.products.update',
      'inventory.stock.manage',
      'pos.sales.read',
      'pos.sales.create',
      'pos.cash.manage',
      'repairs.orders.read',
      'repairs.orders.create',
      'repairs.orders.update',
      'repairs.orders.assign',
      'crm.customers.read',
      'crm.customers.manage',
      'promotions.read',
      'promotions.create',
      'promotions.update',
      'analytics.read'
    ]);
  END IF;

  IF member_role = 'cashier' THEN
    RETURN permission_name = ANY(ARRAY[
      'inventory.products.read',
      'pos.sales.read',
      'pos.sales.create',
      'pos.cash.manage',
      'crm.customers.read'
    ]);
  END IF;

  IF member_role = 'technician' THEN
    RETURN permission_name = ANY(ARRAY[
      'inventory.products.read',
      'inventory.stock.manage',
      'repairs.orders.read',
      'repairs.orders.update'
    ]);
  END IF;

  IF member_role = 'seller' THEN
    RETURN permission_name = ANY(ARRAY[
      'inventory.products.read',
      'pos.sales.read',
      'pos.sales.create',
      'crm.customers.read',
      'crm.customers.manage',
      'promotions.read',
      'promotions.create',
      'promotions.update'
    ]);
  END IF;

  RETURN member_role = 'customer' AND permission_name = 'repairs.orders.read';
END;
$$;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members can read promotions" ON public.promotions;
CREATE POLICY "tenant members can read promotions"
ON public.promotions
FOR SELECT
USING (
  public.has_org_permission(organization_id, 'promotions.read')
);

DROP POLICY IF EXISTS "tenant members can create promotions" ON public.promotions;
CREATE POLICY "tenant members can create promotions"
ON public.promotions
FOR INSERT
WITH CHECK (
  public.has_org_permission(organization_id, 'promotions.create')
);

DROP POLICY IF EXISTS "tenant members can update promotions" ON public.promotions;
CREATE POLICY "tenant members can update promotions"
ON public.promotions
FOR UPDATE
USING (
  public.has_org_permission(organization_id, 'promotions.update')
)
WITH CHECK (
  public.has_org_permission(organization_id, 'promotions.update')
);

DROP POLICY IF EXISTS "tenant members can delete promotions" ON public.promotions;
CREATE POLICY "tenant members can delete promotions"
ON public.promotions
FOR DELETE
USING (
  public.has_org_permission(organization_id, 'promotions.delete')
);

NOTIFY pgrst, 'reload schema';
