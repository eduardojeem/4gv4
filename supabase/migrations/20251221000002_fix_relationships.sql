-- Fix relationships for sales and sale_items tables

-- 1. Clean up invalid data that would violate FK constraints
DELETE FROM sale_items 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);

-- 2. Add Foreign Key to sale_items -> products
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sale_items_product_id_fkey') THEN
    ALTER TABLE sale_items 
    ADD CONSTRAINT sale_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Fix sales -> customers Foreign Key
-- Note: The initial migration might have pointed to 'profiles'. We want 'customers'.
DO $$ 
BEGIN 
  -- Check if customers table exists to avoid errors
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers') THEN
      -- Drop old constraint if exists (it might be named sales_customer_id_fkey)
      ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;
      
      -- Add new constraint pointing to customers
      ALTER TABLE sales 
      ADD CONSTRAINT sales_customer_id_fkey 
      FOREIGN KEY (customer_id) 
      REFERENCES customers(id) 
      ON DELETE SET NULL;
  END IF;
END $$;
