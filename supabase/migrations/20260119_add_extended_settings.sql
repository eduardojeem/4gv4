-- =====================================================
-- MIGRACIÓN: Configuración Extendida
-- Fecha: 2026-01-19
-- Descripción: Agrega campos para personalización, características y configuraciones regionales
-- =====================================================

-- 1. Agregar columnas a system_settings
-- =====================================================
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT 'blue',
ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS time_zone TEXT DEFAULT 'America/Asuncion',
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'es',
ADD COLUMN IF NOT EXISTS items_per_page INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"blog": false, "reviews": true, "api_access": false}'::jsonb,
ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 90;

-- 2. Agregar constraints
-- =====================================================
ALTER TABLE system_settings 
ADD CONSTRAINT valid_items_per_page CHECK (items_per_page >= 5 AND items_per_page <= 100),
ADD CONSTRAINT valid_retention_days CHECK (retention_days >= 30 AND retention_days <= 3650);

-- 3. Comentarios
-- =====================================================
COMMENT ON COLUMN system_settings.theme IS 'Tema de la interfaz: light, dark, system';
COMMENT ON COLUMN system_settings.features IS 'Flags para habilitar/deshabilitar módulos';
COMMENT ON COLUMN system_settings.social_links IS 'URLs de redes sociales';

-- 4. Actualizar auditoría (opcional, si se necesita lógica específica en el trigger)
-- El trigger log_settings_change ya itera sobre todas las columnas, 
-- así que capturará estos nuevos campos automáticamente.
