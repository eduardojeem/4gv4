
-- Add missing columns to cash_movements if they don't exist

-- Add reason column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_movements' AND column_name = 'reason') THEN 
        ALTER TABLE public.cash_movements ADD COLUMN reason TEXT; 
    END IF; 
END $$;

-- Add payment_method column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_movements' AND column_name = 'payment_method') THEN 
        ALTER TABLE public.cash_movements ADD COLUMN payment_method TEXT; 
    END IF; 
END $$;

-- Ensure RLS policies are refreshed
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Re-grant permissions to be safe
GRANT ALL ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

-- Force schema cache reload hint (comment)
-- NOTIFY pgrst, 'reload config'; 
-- This usually happens automatically on DDL.
