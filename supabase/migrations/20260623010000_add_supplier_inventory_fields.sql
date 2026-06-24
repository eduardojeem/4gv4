-- Add supplier fields used by /admin/inventory supplier management.
-- The API reads and writes these fields, so they must exist in the live schema.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_debt NUMERIC(12, 2) DEFAULT 0;
