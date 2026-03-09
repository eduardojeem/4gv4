-- Add 'pausado' status to repair_status enum
-- This migration adds the missing 'pausado' status that is used in the frontend

-- Add the new value to the enum
-- We use IF NOT EXISTS to avoid errors if it was already added manually
ALTER TYPE repair_status ADD VALUE IF NOT EXISTS 'pausado';

-- Add comment for documentation to reflect the new state
COMMENT ON TYPE repair_status IS 'Status values for repairs: recibido, diagnostico, reparacion, pausado, listo, entregado, cancelado';
