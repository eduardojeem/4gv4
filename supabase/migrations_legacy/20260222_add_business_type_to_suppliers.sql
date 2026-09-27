
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'distributor' 
CHECK (business_type IN ('manufacturer', 'distributor', 'wholesaler', 'retailer', 'service_provider'));

-- Update existing records if any (though default handles new ones, existing ones will get the default if we use DEFAULT in ADD COLUMN, but let's be safe)
UPDATE suppliers SET business_type = 'distributor' WHERE business_type IS NULL;
