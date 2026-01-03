-- =====================================================
-- SCRIPT DE CORRECCIÓN: Columnas faltantes y caché de esquema
-- Fecha: 2025-01-03
-- Descripción: Verifica y crea columnas faltantes, luego recarga la caché
-- =====================================================

DO $$
BEGIN
    -- 1. Verificar y agregar 'received_at'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repairs' AND column_name = 'received_at') THEN
        ALTER TABLE repairs ADD COLUMN received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        COMMENT ON COLUMN repairs.received_at IS 'Fecha y hora en que se recibió el dispositivo';
        
        -- Actualizar registros existentes si es necesario
        UPDATE repairs SET received_at = created_at WHERE received_at IS NULL;
    END IF;

    -- 2. Verificar y agregar 'access_type'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repairs' AND column_name = 'access_type') THEN
        ALTER TABLE repairs ADD COLUMN access_type TEXT DEFAULT 'none' CHECK (access_type IN ('none', 'pin', 'password', 'pattern', 'biometric', 'other'));
        COMMENT ON COLUMN repairs.access_type IS 'Tipo de protección de acceso al dispositivo: ninguno, pin, contraseña, patrón, biométrico, otro';
        CREATE INDEX IF NOT EXISTS idx_repairs_access_type ON repairs(access_type);
    END IF;

    -- 3. Verificar y agregar 'access_password'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repairs' AND column_name = 'access_password') THEN
        ALTER TABLE repairs ADD COLUMN access_password TEXT;
        COMMENT ON COLUMN repairs.access_password IS 'Credenciales de acceso al dispositivo o descripción del patrón';
    END IF;

END $$;

-- 4. Forzar recarga de caché de esquema para PostgREST
-- Esto es crucial para solucionar el error "Could not find the ... column ... in the schema cache"
NOTIFY pgrst, 'reload schema';
