-- Consolidated fix for website_settings
-- Standardizes RLS and ensures all necessary data exists

-- 1. Ensure table structure is correct
CREATE TABLE IF NOT EXISTS public.website_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Ensure RLS is enabled
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- 3. Consolidate Policies
DROP POLICY IF EXISTS "Anyone can read website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Admins can update website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Admins can insert website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Admins can manage website settings" ON public.website_settings;

-- Public read access
CREATE POLICY "Anyone can read website settings"
    ON public.website_settings FOR SELECT
    USING (true);

-- Admin manage access (Checks both profiles and user_roles for robustness)
CREATE POLICY "Admins can manage website settings"
    ON public.website_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'super_admin')
            AND user_roles.is_active = true
        )
    );

-- 4. Ensure default data exists for all required keys
INSERT INTO public.website_settings (key, value)
VALUES 
('company_info', '{
  "phone": "+595 981 234 567",
  "email": "info@4gcelulares.com",
  "address": "Av. Principal 123, Asunción",
  "hours": {
    "weekdays": "Lun - Vie: 08:00 - 18:00",
    "saturday": "Sáb: 09:00 - 13:00",
    "sunday": "Dom: Cerrado"
  }
}'::jsonb),
('hero_content', '{
  "badge": "✨ Más de 10 años de experiencia",
  "title": "Reparación de celulares rápida y confiable",
  "subtitle": "Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
}'::jsonb),
('hero_stats', '{
  "repairs": "10K+",
  "satisfaction": "98%",
  "avgTime": "24-48h"
}'::jsonb),
('services', '[
  {
    "id": "screens",
    "title": "Reparación de pantallas",
    "description": "Reemplazo de pantallas rotas con repuestos originales y garantía",
    "icon": "wrench",
    "color": "blue",
    "benefits": ["Repuestos originales", "Instalación en 1 hora"]
  }
]'::jsonb),
('testimonials', '[]'::jsonb),
('maintenance_mode', '{
  "enabled": false,
  "title": "Sitio en Mantenimiento",
  "message": "Estamos realizando mejoras en nuestro sitio. Volveremos pronto.",
  "estimatedEnd": ""
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_website_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_website_settings_updated_at ON public.website_settings;
CREATE TRIGGER tr_website_settings_updated_at
    BEFORE UPDATE ON public.website_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_website_settings_updated_at();
