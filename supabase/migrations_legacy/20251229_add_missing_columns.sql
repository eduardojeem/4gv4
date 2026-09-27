-- Add only the missing columns that the frontend expects
-- Based on the existing data structure

-- Add missing columns for promotions functionality
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_purchase DECIMAL(12,2) DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_discount DECIMAL(12,2);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS applicable_products TEXT[];
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS applicable_categories TEXT[];
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have reasonable defaults
UPDATE promotions SET 
    description = CASE 
        WHEN name = 'Descuento de Verano' THEN '20% de descuento en productos seleccionados'
        WHEN name = 'Liquidación Accesorios' THEN '30% de descuento en todos los accesorios'
        WHEN name = 'Envío Gratis' THEN 'Envío gratuito en compras superiores a $100.000'
        WHEN name = 'Black Friday Anticipado' THEN '15% de descuento anticipado Black Friday'
        WHEN name = 'Día de la Madre' THEN '25% de descuento especial Día de la Madre'
        ELSE 'Promoción especial'
    END,
    start_date = CASE 
        WHEN is_active = true THEN NOW() - INTERVAL '1 day'
        ELSE NOW() - INTERVAL '30 days'
    END,
    end_date = CASE 
        WHEN is_active = true THEN NOW() + INTERVAL '30 days'
        ELSE NOW() - INTERVAL '1 day'
    END,
    usage_count = 0,
    min_purchase = CASE 
        WHEN name = 'Envío Gratis' THEN 100000
        WHEN name = 'Black Friday Anticipado' THEN 50000
        ELSE 0
    END
WHERE description IS NULL OR start_date IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- Add unique constraint for code if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'promotions_code_unique'
    ) THEN
        ALTER TABLE promotions ADD CONSTRAINT promotions_code_unique UNIQUE (code);
    END IF;
END $$;

-- Add check constraint for type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'promotions_type_check'
    ) THEN
        ALTER TABLE promotions ADD CONSTRAINT promotions_type_check CHECK (type IN ('percentage', 'fixed'));
    END IF;
END $$;

-- Create trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_promotions_updated_at ON promotions;
CREATE TRIGGER update_promotions_updated_at 
    BEFORE UPDATE ON promotions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();