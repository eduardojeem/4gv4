-- Add status column to suppliers table and migrate data
-- This migration adds the status column and migrates from is_active boolean to status enum

BEGIN;

-- Add status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'suppliers' AND column_name = 'status') THEN
        ALTER TABLE public.suppliers 
        ADD COLUMN status TEXT DEFAULT 'pending' 
        CHECK (status IN ('active','inactive','pending','suspended'));
    END IF;
END $$;

-- Migrate data from is_active to status if is_active column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'suppliers' AND column_name = 'is_active') THEN
        -- Update status based on is_active
        UPDATE public.suppliers 
        SET status = CASE 
            WHEN is_active = true THEN 'active'
            WHEN is_active = false THEN 'inactive'
            ELSE 'pending'
        END
        WHERE status = 'pending'; -- Only update records that haven't been manually set
        
        -- Drop the is_active column after migration
        ALTER TABLE public.suppliers DROP COLUMN IF EXISTS is_active;
    END IF;
END $$;

-- Update the get_supplier_stats function to work with the new status column
DROP FUNCTION IF EXISTS get_supplier_stats() CASCADE;

CREATE OR REPLACE FUNCTION get_supplier_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_suppliers', COUNT(*)::bigint,
        'active_suppliers', COUNT(*) FILTER (WHERE status = 'active')::bigint,
        'inactive_suppliers', COUNT(*) FILTER (WHERE status = 'inactive')::bigint,
        'pending_suppliers', COUNT(*) FILTER (WHERE status = 'pending')::bigint,
        'avg_rating', COALESCE(AVG(rating), 0)::numeric,
        'total_orders', COALESCE(SUM(total_orders), 0)::bigint,
        'total_amount', COALESCE(SUM(total_amount), 0)::numeric
    ) INTO result
    FROM suppliers;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_supplier_stats() TO authenticated;

-- Create index on status column for better performance
CREATE INDEX IF NOT EXISTS idx_suppliers_status_new ON public.suppliers(status);

COMMIT;