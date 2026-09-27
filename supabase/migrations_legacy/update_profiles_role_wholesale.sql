-- Update profiles.role to allow wholesale customer role
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT conname 
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'profiles' AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', rec.conname);
    END LOOP;

    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
        'user', 'admin', 'super_admin', 'technician', 'manager', 'cashier',
        'cliente', 'mayorista', 'vendedor', 'supervisor', 'tecnico'
    ]));
END $$;
