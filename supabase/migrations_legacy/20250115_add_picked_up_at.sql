-- =====================================================
-- Add picked_up_at field to track when customer picks up device
-- Fecha: 2025-01-15
-- Descripción: Agrega campo para registrar cuándo el cliente retira el equipo
--              La garantía debe comenzar desde esta fecha
-- =====================================================

-- Add picked_up_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='picked_up_at'
  ) THEN
    ALTER TABLE repairs ADD COLUMN picked_up_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN repairs.picked_up_at IS 'Fecha y hora en que el cliente retiró el equipo reparado';
  END IF;
END $$;

-- Create index for picked_up_at queries
CREATE INDEX IF NOT EXISTS idx_repairs_picked_up_at 
  ON repairs(picked_up_at) 
  WHERE picked_up_at IS NOT NULL;

-- Update existing repairs: if status is 'entregado', set picked_up_at = delivered_at
UPDATE repairs 
SET picked_up_at = delivered_at 
WHERE status = 'entregado' 
  AND delivered_at IS NOT NULL 
  AND picked_up_at IS NULL;

-- Update warranty_expires_at to be based on picked_up_at instead of completed_at
UPDATE repairs 
SET warranty_expires_at = picked_up_at + (warranty_months || ' months')::INTERVAL
WHERE picked_up_at IS NOT NULL 
  AND warranty_months > 0;
