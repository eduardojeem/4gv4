-- ============================================================================
-- Variant attributes + options tables for product variants
-- Fecha: 2026-03-10
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.variant_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('color', 'size', 'text', 'number')),
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.variant_attribute_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES public.variant_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_value TEXT,
  color_hex TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attribute_id, value)
);

CREATE INDEX IF NOT EXISTS idx_variant_attributes_sort
  ON public.variant_attributes(sort_order, name);

CREATE INDEX IF NOT EXISTS idx_variant_attributes_active
  ON public.variant_attributes(is_active);

CREATE INDEX IF NOT EXISTS idx_variant_attribute_options_attribute
  ON public.variant_attribute_options(attribute_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_variant_attribute_options_active
  ON public.variant_attribute_options(is_active);

ALTER TABLE public.variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_attribute_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS variant_attributes_select_authenticated ON public.variant_attributes;
CREATE POLICY variant_attributes_select_authenticated
ON public.variant_attributes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS variant_attribute_options_select_authenticated ON public.variant_attribute_options;
CREATE POLICY variant_attribute_options_select_authenticated
ON public.variant_attribute_options
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS variant_attributes_write_staff ON public.variant_attributes;
CREATE POLICY variant_attributes_write_staff
ON public.variant_attributes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'vendedor', 'tecnico')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'vendedor', 'tecnico')
  )
);

DROP POLICY IF EXISTS variant_attribute_options_write_staff ON public.variant_attribute_options;
CREATE POLICY variant_attribute_options_write_staff
ON public.variant_attribute_options
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'vendedor', 'tecnico')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'vendedor', 'tecnico')
  )
);
