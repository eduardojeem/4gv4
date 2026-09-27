-- Add device access fields to repairs table
-- Migration: 20241228_add_device_access_fields.sql

-- Add access_type and access_password fields to repairs table
ALTER TABLE repairs 
ADD COLUMN access_type TEXT DEFAULT 'none' CHECK (access_type IN ('none', 'pin', 'password', 'pattern', 'biometric', 'other')),
ADD COLUMN access_password TEXT;

-- Add comment for documentation
COMMENT ON COLUMN repairs.access_type IS 'Type of device access protection: none, pin, password, pattern, biometric, other';
COMMENT ON COLUMN repairs.access_password IS 'Device access credentials or pattern description';

-- Create index for access_type for potential filtering
CREATE INDEX idx_repairs_access_type ON repairs(access_type);

-- Update existing records to have default access_type
UPDATE repairs SET access_type = 'none' WHERE access_type IS NULL;