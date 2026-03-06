-- Final hardening for website_settings used by /admin/website and public website API.
-- Safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS public.website_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS value jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.website_settings
  ALTER COLUMN key SET NOT NULL,
  ALTER COLUMN value SET NOT NULL,
  ALTER COLUMN value SET DEFAULT '{}'::jsonb,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'website_settings_pkey'
      AND conrelid = 'public.website_settings'::regclass
  ) THEN
    ALTER TABLE public.website_settings
      ADD CONSTRAINT website_settings_pkey PRIMARY KEY (key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_website_settings_updated_at
  ON public.website_settings (updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_website_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_website_settings_updated_at ON public.website_settings;
CREATE TRIGGER tr_website_settings_updated_at
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_website_settings_updated_at();

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_settings_public_select ON public.website_settings;
DROP POLICY IF EXISTS website_settings_admin_insert ON public.website_settings;
DROP POLICY IF EXISTS website_settings_admin_update ON public.website_settings;
DROP POLICY IF EXISTS website_settings_admin_delete ON public.website_settings;
DROP POLICY IF EXISTS "Anyone can read website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Admins can update website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Admins can insert website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Admins can manage website settings" ON public.website_settings;

CREATE POLICY website_settings_public_select
ON public.website_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY website_settings_admin_insert
ON public.website_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND ur.role IN ('admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY website_settings_admin_update
ON public.website_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND ur.role IN ('admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND ur.role IN ('admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY website_settings_admin_delete
ON public.website_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND ur.role IN ('admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
);

INSERT INTO public.website_settings (key, value)
VALUES
  (
    'company_info',
    '{"name":"","phone":"","email":"","address":"","hours":{"weekdays":"","saturday":"","sunday":""},"logoUrl":"","brandColor":"blue","headerStyle":"glass","headerColor":"","showTopBar":true}'::jsonb
  ),
  (
    'hero_content',
    '{"badge":"Servicio tecnico especializado","title":"Reparacion profesional para tu equipo","subtitle":"Diagnostico claro, repuestos de calidad y seguimiento en linea."}'::jsonb
  ),
  (
    'hero_stats',
    '{"repairs":"0+","satisfaction":"0%","avgTime":"24h"}'::jsonb
  ),
  (
    'services',
    '[]'::jsonb
  ),
  (
    'testimonials',
    '[]'::jsonb
  ),
  (
    'maintenance_mode',
    '{"enabled":false,"title":"Sitio en Mantenimiento","message":"Estamos realizando mejoras en nuestro sitio. Volveremos pronto.","estimatedEnd":""}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
