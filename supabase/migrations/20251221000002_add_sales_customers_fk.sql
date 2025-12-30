-- Add foreign key from sales to customers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sales_customer'
  ) THEN
    ALTER TABLE sales
    ADD CONSTRAINT fk_sales_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE SET NULL;
  END IF;
END $$;
