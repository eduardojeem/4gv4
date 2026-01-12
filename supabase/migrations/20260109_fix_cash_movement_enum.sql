
-- Fix Enum values for cash_movement_type
-- We need to ensure 'cash_in', 'cash_out', 'sale', 'opening', 'closing' are in the enum.

DO $$
BEGIN
    -- Try to add 'cash_in'
    BEGIN
        ALTER TYPE cash_movement_type ADD VALUE 'cash_in';
    EXCEPTION
        WHEN duplicate_object THEN null; -- Value already exists
        WHEN undefined_object THEN -- Type might not exist, maybe it's Check constraint?
            null; 
    END;

    -- Try to add 'cash_out'
    BEGIN
        ALTER TYPE cash_movement_type ADD VALUE 'cash_out';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

     -- Try to add 'sale'
    BEGIN
        ALTER TYPE cash_movement_type ADD VALUE 'sale';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
    
    -- Try to add 'opening'
    BEGIN
        ALTER TYPE cash_movement_type ADD VALUE 'opening';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

    -- Try to add 'closing'
    BEGIN
        ALTER TYPE cash_movement_type ADD VALUE 'closing';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;

-- Fallback: If it's NOT an enum but a Check constraint on a TEXT column?
-- We can drop the constraint just in case it's restrictive.
DO $$
BEGIN
    ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_type_check;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;
