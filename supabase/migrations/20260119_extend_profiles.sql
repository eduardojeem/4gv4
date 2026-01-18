-- =====================================================
-- MIGRACIÓN: Perfil de Usuario Extendido
-- Fecha: 2026-01-19
-- Descripción: Agrega campos para perfil extendido en tabla profiles
-- =====================================================

-- 1. Agregar columnas a profiles
-- =====================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Asuncion',
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- 2. Comentarios
-- =====================================================
COMMENT ON COLUMN profiles.bio IS 'Biografía corta del usuario';
COMMENT ON COLUMN profiles.job_title IS 'Cargo o título profesional';
COMMENT ON COLUMN profiles.social_links IS 'Enlaces a redes sociales';
COMMENT ON COLUMN profiles.preferences IS 'Preferencias de usuario persistentes (tema, notificaciones)';

-- 3. Políticas de seguridad (Asegurar que el usuario puede editar sus nuevos campos)
-- Las políticas existentes (profiles_update_own) ya deberían cubrir UPDATE en toda la fila,
-- pero es bueno verificar si hay restricciones de columnas.
-- Si la política es USING (id = auth.uid()), cubre todas las columnas.

