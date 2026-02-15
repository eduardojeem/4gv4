-- Migración de corrección para website_settings
-- Asegura que la tabla existe y usa el esquema de roles basado en 'profiles' (No SaaS)

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS website_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Asegurar datos iniciales mínimos si está vacía
INSERT INTO website_settings (key, value)
SELECT 'company_info', '{"name": "4G Celulares", "phone": "", "email": "", "address": ""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM website_settings WHERE key = 'company_info');

-- 3. Habilitar RLS
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Anyone can read website settings" ON website_settings;
DROP POLICY IF EXISTS "Admins can update website settings" ON website_settings;
DROP POLICY IF EXISTS "Admins can insert website settings" ON website_settings;

-- 5. Crear políticas basadas en la tabla 'profiles' (estándar del proyecto)
CREATE POLICY "Anyone can read website settings"
    ON website_settings FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage website settings"
    ON website_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 6. Trigger para updated_at (si no existe)
CREATE OR REPLACE FUNCTION update_website_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_website_settings_updated_at ON website_settings;
CREATE TRIGGER tr_website_settings_updated_at
    BEFORE UPDATE ON website_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_website_settings_updated_at();
