-- =====================================================
-- MIGRACIÓN: Agregar campo ciudad a system_settings
-- Fecha: 2025-01-15
-- Descripción: Añade el campo city para almacenar la ciudad de la empresa
-- =====================================================

-- Agregar columna city si no existe
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS city TEXT;

-- Comentario para documentación
COMMENT ON COLUMN system_settings.city IS 'Ciudad donde se encuentra la empresa';

-- Actualizar el registro existente con un valor por defecto si está vacío
UPDATE system_settings 
SET city = 'Asunción' 
WHERE id = 'system' AND (city IS NULL OR city = '');

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
