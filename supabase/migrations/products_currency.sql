ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'PYG';
UPDATE products SET currency = 'PYG' WHERE currency IS NULL;

ALTER TABLE product_price_history ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'PYG';
UPDATE product_price_history SET currency = 'PYG' WHERE currency IS NULL;
