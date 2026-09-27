ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_settings_public_select ON public.website_settings;
CREATE POLICY website_settings_public_select
ON public.website_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS website_settings_admin_insert ON public.website_settings;
CREATE POLICY website_settings_admin_insert
ON public.website_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND ur.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS website_settings_admin_update ON public.website_settings;
CREATE POLICY website_settings_admin_update
ON public.website_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND ur.role IN ('admin', 'super_admin')
  )
);
