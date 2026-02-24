-- Fix permissions and backfill missing data
-- This migration ensures that all users have profiles and customers, and fixes potential permission issues

-- 1. Grant permissions on sequence (Crucial for customer_code generation)
DO $$
BEGIN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE customer_code_seq TO authenticated';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE customer_code_seq TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE customer_code_seq TO postgres';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Grant table permissions explicitly
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON customers TO authenticated;
GRANT ALL ON profiles TO service_role;
GRANT ALL ON customers TO service_role;

-- 3. Create a backfill function to fix missing profiles and customers
CREATE OR REPLACE FUNCTION public.backfill_missing_user_data()
RETURNS void
SET search_path = public
AS $$
DECLARE
    auth_user RECORD;
    profile_exists BOOLEAN;
    customer_exists BOOLEAN;
    full_name_val TEXT;
    first_name_val TEXT;
    last_name_val TEXT;
    user_email TEXT;
    user_phone TEXT;
BEGIN
    FOR auth_user IN SELECT id, email, raw_user_meta_data, phone FROM auth.users LOOP
        -- Extract user data
        user_email := auth_user.email;
        full_name_val := COALESCE(auth_user.raw_user_meta_data->>'full_name', 'Usuario');
        first_name_val := COALESCE(split_part(full_name_val, ' ', 1), 'Usuario');
        last_name_val := COALESCE(NULLIF(substring(full_name_val from position(' ' in full_name_val) + 1), ''), '');
        user_phone := COALESCE(auth_user.phone, '');

        -- Check if profile exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth_user.id) INTO profile_exists;
        
        IF NOT profile_exists THEN
            RAISE NOTICE 'Creating missing profile for user %', user_email;
            INSERT INTO profiles (id, email, full_name, role)
            VALUES (
                auth_user.id,
                user_email,
                full_name_val,
                'cliente'
            );
        END IF;

        -- Check if customer exists
        SELECT EXISTS(SELECT 1 FROM customers WHERE profile_id = auth_user.id) INTO customer_exists;
        
        IF NOT customer_exists THEN
            RAISE NOTICE 'Creating missing customer for user %', user_email;
            INSERT INTO customers (
                profile_id,
                name,
                first_name,
                last_name,
                email,
                phone,
                customer_type,
                segment,
                status,
                created_at,
                updated_at
            ) VALUES (
                auth_user.id,
                full_name_val,
                first_name_val,
                last_name_val,
                user_email,
                user_phone,
                'regular',
                'regular',
                'active',
                NOW(),
                NOW()
            );
            -- Removed ON CONFLICT (customer_code) because we rely on trigger to generate it
            -- and unique constraint will raise error if collision (unlikely with sequence)
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Execute the backfill
SELECT public.backfill_missing_user_data();

-- 5. Drop the temporary backfill function
DROP FUNCTION public.backfill_missing_user_data();

-- 6. Add policy for admins to view all profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles'
    ) THEN
        CREATE POLICY "Admins can view all profiles" ON public.profiles
        FOR SELECT TO authenticated
        USING (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin', 'vendedor')
            OR auth.uid() = id
        );
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Permisos corregidos y datos faltantes generados';
END $$;
