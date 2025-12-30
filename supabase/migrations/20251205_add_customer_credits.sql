-- Add credit columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN customers.credit_limit IS 'Maximum credit amount allowed for the customer';
COMMENT ON COLUMN customers.current_balance IS 'Current amount owed by the customer';
