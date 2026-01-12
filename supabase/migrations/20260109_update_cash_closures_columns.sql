-- Add missing columns to cash_closures table
-- Based on requirements from useCashRegister.ts hook

ALTER TABLE public.cash_closures 
ADD COLUMN IF NOT EXISTS discrepancy BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS opened_by TEXT,
ADD COLUMN IF NOT EXISTS closed_by TEXT;

-- Update RLS if needed (already enabled and allowing all in base script)
-- Ensure the new columns are accessible
GRANT ALL ON TABLE public.cash_closures TO authenticated;
GRANT ALL ON TABLE public.cash_closures TO service_role;
