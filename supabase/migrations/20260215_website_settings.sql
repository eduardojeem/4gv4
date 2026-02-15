-- Crear tabla para configuración del sitio web público
CREATE TABLE IF NOT EXISTS website_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insertar valores iniciales
INSERT INTO website_settings (key, value) VALUES
('company_info', '{
  "phone": "+595123456789",
  "email": "info@4gcelulares.com",
  "address": "Av. Principal 123, Asunción",
  "hours": {
    "weekdays": "Lun - Vie: 8:00 - 18:00",
    "saturday": "Sáb: 9:00 - 13:00",
    "sunday": "Dom: Cerrado"
  }
}'::jsonb),

('hero_stats', '{
  "repairs": "10K+",
  "satisfaction": "98%",
  "avgTime": "24-48h"
}'::jsonb),

('hero_content', '{
  "badge": "✨ Más de 10 años de experiencia",
  "title": "Reparación de celulares rápida y confiable",
  "subtitle": "Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
}'::jsonb),

('services', '[
  {
    "id": "screens",
    "title": "Reparación de pantallas",
    "description": "Reemplazo de pantallas rotas o dañadas con repuestos originales y garantía",
    "icon": "wrench",
    "color": "blue",
    "benefits": ["Pantallas originales", "Instalación en 1 hora"]
  },
  {
    "id": "battery",
    "title": "Cambio de batería",
    "description": "Baterías de alta calidad para extender la vida útil de tu celular",
    "icon": "package",
    "color": "green",
    "benefits": ["Baterías certificadas", "Garantía de 6 meses"]
  },
  {
    "id": "software",
    "title": "Reparación de software",
    "description": "Solución de problemas de sistema, actualizaciones y recuperación de datos",
    "icon": "shield",
    "color": "purple",
    "benefits": ["Diagnóstico gratuito", "Recuperación de datos"]
  }
]'::jsonb),

('testimonials', '[
  {
    "id": "1",
    "name": "María González",
    "rating": 5,
    "comment": "Excelente servicio, cambiaron la pantalla de mi Samsung en menos de 1 hora. Quedó perfecta y con garantía."
  },
  {
    "id": "2",
    "name": "Carlos Ramírez",
    "rating": 5,
    "comment": "Muy profesionales y honestos. Me explicaron todo el problema y el precio fue justo. 100% recomendado."
  },
  {
    "id": "3",
    "name": "Ana Martínez",
    "rating": 5,
    "comment": "Rápido y confiable. Mi iPhone quedó como nuevo después del cambio de batería. Excelente atención al cliente."
  }
]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Habilitar RLS
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer (para el portal público)
CREATE POLICY "Anyone can read website settings"
  ON website_settings
  FOR SELECT
  USING (true);

-- Policy: Solo admins pueden actualizar
CREATE POLICY "Admins can update website settings"
  ON website_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Solo admins pueden insertar
CREATE POLICY "Admins can insert website settings"
  ON website_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_website_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER website_settings_updated_at
  BEFORE UPDATE ON website_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_website_settings_updated_at();
