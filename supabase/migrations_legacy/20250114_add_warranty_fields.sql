-- =====================================================
-- Add Warranty Fields to Repairs Table
-- Fecha: 2025-01-14
-- Descripción: Agrega campos adicionales de garantía
-- =====================================================

-- Add warranty_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='warranty_type'
  ) THEN
    ALTER TABLE repairs ADD COLUMN warranty_type VARCHAR(20) DEFAULT 'full';
    COMMENT ON COLUMN repairs.warranty_type IS 'Tipo de garantía: labor (mano de obra), parts (repuestos), full (completa)';
  END IF;
END $$;

-- Add warranty_notes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='warranty_notes'
  ) THEN
    ALTER TABLE repairs ADD COLUMN warranty_notes TEXT;
    COMMENT ON COLUMN repairs.warranty_notes IS 'Notas adicionales sobre la garantía';
  END IF;
END $$;

-- Ensure warranty_months has a default value
DO $$ 
BEGIN
  ALTER TABLE repairs ALTER COLUMN warranty_months SET DEFAULT 0;
EXCEPTION
  WHEN OTHERS THEN
    -- Column might not exist or already has default
    NULL;
END $$;

-- Ensure warranty_expires_at exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='warranty_expires_at'
  ) THEN
    ALTER TABLE repairs ADD COLUMN warranty_expires_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN repairs.warranty_expires_at IS 'Fecha de expiración de la garantía';
  END IF;
END $$;

-- Create index for warranty expiration queries
CREATE INDEX IF NOT EXISTS idx_repairs_warranty_expires_at 
  ON repairs(warranty_expires_at) 
  WHERE warranty_expires_at IS NOT NULL;

-- Create index for warranty type
CREATE INDEX IF NOT EXISTS idx_repairs_warranty_type 
  ON repairs(warranty_type);

-- Update existing repairs with default warranty type if NULL
UPDATE repairs 
SET warranty_type = 'full' 
WHERE warranty_type IS NULL;

-- Verification
DO $$
DECLARE
  warranty_type_exists BOOLEAN;
  warranty_notes_exists BOOLEAN;
  warranty_expires_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='warranty_type'
  ) INTO warranty_type_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='warranty_notes'
  ) INTO warranty_notes_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='repairs' AND column_name='warranty_expires_at'
  ) INTO warranty_expires_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ACTUALIZACIÓN DE CAMPOS DE GARANTÍA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'warranty_type: %', CASE WHEN warranty_type_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE 'warranty_notes: %', CASE WHEN warranty_notes_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE 'warranty_expires_at: %', CASE WHEN warranty_expires_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE '========================================';
  
  IF warranty_type_exists AND warranty_notes_exists AND warranty_expires_exists THEN
    RAISE NOTICE '✓✓✓ ÉXITO ✓✓✓';
    RAISE NOTICE 'Todos los campos de garantía están listos';
  ELSE
    RAISE NOTICE '⚠ Advertencia: Algunos campos no se crearon';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
