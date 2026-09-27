-- Migración segura para agregar campos de acceso si no existen
-- Ejecute esto en el Editor SQL de Supabase

DO $$
BEGIN
    -- Verificar y agregar access_type si falta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repairs' AND column_name = 'access_type') THEN
        ALTER TABLE repairs ADD COLUMN access_type TEXT DEFAULT 'none' CHECK (access_type IN ('none', 'pin', 'password', 'pattern', 'biometric', 'other'));
        COMMENT ON COLUMN repairs.access_type IS 'Tipo de protección de acceso al dispositivo: ninguno, pin, contraseña, patrón, biométrico, otro';
        CREATE INDEX idx_repairs_access_type ON repairs(access_type);
    END IF;

    -- Verificar y agregar access_password si falta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repairs' AND column_name = 'access_password') THEN
        ALTER TABLE repairs ADD COLUMN access_password TEXT;
        COMMENT ON COLUMN repairs.access_password IS 'Credenciales de acceso al dispositivo o descripción del patrón';
    END IF;
END $$;

-- Forzar recarga de caché de esquema para PostgREST
NOTIFY pgrst, 'reload schema';
