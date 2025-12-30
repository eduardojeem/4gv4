-- Align products table with types.ts definition
-- Run this in Supabase SQL Editor

-- 1. Ensure columns exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS unit_measure TEXT DEFAULT 'unidad',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- 2. Handle legacy 'stock' column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock') THEN
        -- Copy data from stock to stock_quantity if stock_quantity is 0 (assuming new column)
        UPDATE products SET stock_quantity = stock WHERE stock_quantity = 0 AND stock > 0;
    END IF;
END $$;

-- 3. Ensure Services category exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Servicios') THEN
        INSERT INTO categories (name, description, is_active)
        VALUES ('Servicios', 'Mano de obra y reparaciones', true);
    END IF;
END $$;
