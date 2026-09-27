-- Add 'cancelado' status to repair_status enum
-- This migration adds the missing 'cancelado' status that is used in the frontend

-- Add the new value to the enum
ALTER TYPE repair_status ADD VALUE 'cancelado';

-- Update any existing repairs that might need this status
-- (This is optional - only if you have data that needs to be updated)
-- UPDATE repairs SET status = 'cancelado' WHERE status = 'some_old_status';

-- Add comment for documentation
COMMENT ON TYPE repair_status IS 'Status values for repairs: recibido, diagnostico, reparacion, listo, entregado, cancelado';