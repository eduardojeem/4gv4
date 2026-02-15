-- Actualizar políticas RLS para permitir 'admin' y 'super_admin'
-- Nota: usamos DROP POLICY seguido de CREATE POLICY con condición ampliada

BEGIN;

-- Eliminar políticas existentes si existen
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'website_settings' 
      AND policyname = 'Admins can update website settings'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can update website settings" ON public.website_settings';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'website_settings' 
      AND policyname = 'Admins can insert website settings'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can insert website settings" ON public.website_settings';
  END IF;
END$$;

-- Crear políticas nuevas permitiendo ambos roles
CREATE POLICY "Admins or Super Admins can update website settings"
  ON public.website_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins or Super Admins can insert website settings"
  ON public.website_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

COMMIT;

