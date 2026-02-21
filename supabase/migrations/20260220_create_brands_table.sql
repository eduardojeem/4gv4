-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  website VARCHAR(200),
  country VARCHAR(100),
  founded_year INTEGER,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Create policies for brands
DROP POLICY IF EXISTS "Allow all for authenticated users" ON brands;
CREATE POLICY "Allow all for authenticated users" ON brands
  FOR ALL USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add brand_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Create index for brand_id
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- Migrate existing brands from products table to brands table
INSERT INTO brands (name)
SELECT DISTINCT brand
FROM products
WHERE brand IS NOT NULL AND brand != ''
ON CONFLICT (name) DO NOTHING;

-- Update products with brand_id
UPDATE products p
SET brand_id = b.id
FROM brands b
WHERE p.brand = b.name
AND p.brand_id IS NULL;

-- Comment on table
COMMENT ON TABLE brands IS 'Marcas de productos';
