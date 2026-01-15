-- =====================================================
-- Update Existing Repairs with Default Warranty Values
-- Fecha: 2025-01-14
-- Descripción: Actualiza reparaciones existentes con garantía por defecto
-- =====================================================

-- Update all repairs that don't have warranty (warranty_months = 0 or NULL)
-- to have the default warranty values
UPDATE repairs 
SET 
  warranty_months = 3,
  warranty_type = 'full',
  warranty_expires_at = CASE 
    WHEN completed_at IS NOT NULL THEN completed_at + INTERVAL '3 months'
    WHEN created_at IS NOT NULL THEN created_at + INTERVAL '3 months'
    ELSE NOW() + INTERVAL '3 months'
  END
WHERE warranty_months = 0 OR warranty_months IS NULL;
