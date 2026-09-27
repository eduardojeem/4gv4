
DO $$
DECLARE
    enum_vals text;
BEGIN
    SELECT string_agg(e.enumlabel, ', ')
    INTO enum_vals
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'user_role';
    
    RAISE NOTICE 'Enum user_role values: %', enum_vals;
END $$;
