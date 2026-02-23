
-- Add visibility column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'public';

-- Update existing products to have visibility 'public'
UPDATE products SET visibility = 'public' WHERE visibility IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(visibility);

-- Constraint to ensure valid values
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_visibility_check;

ALTER TABLE products 
ADD CONSTRAINT products_visibility_check 
CHECK (visibility IN ('public', 'wholesale', 'hidden'));
