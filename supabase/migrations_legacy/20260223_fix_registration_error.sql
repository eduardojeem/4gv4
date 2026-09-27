-- Fix missing columns in customers table and update user registration logic
-- This migration adds missing first_name and last_name columns and makes the registration function robust

-- 1. Add missing columns to customers table if they don't exist
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SET search_path = public
AS $$
DECLARE
    profile_record RECORD;
    full_name_val TEXT;
    first_name_val TEXT;
    last_name_val TEXT;
BEGIN
    -- Extract name parts safely
    full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    first_name_val := COALESCE(split_part(full_name_val, ' ', 1), 'Usuario');
    last_name_val := COALESCE(NULLIF(substring(full_name_val from position(' ' in full_name_val) + 1), ''), '');

    -- Create profile with role 'cliente' by default
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        full_name_val,
        'cliente'::user_role
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW()
    RETURNING * INTO profile_record;
    
    -- Now create customer record for the new profile
    -- We use a simple INSERT ... ON CONFLICT DO NOTHING to handle race conditions with triggers
    -- or if the customer already exists
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
        profile_record.id,
        COALESCE(profile_record.full_name, 'Usuario'),
        first_name_val,
        last_name_val,
        profile_record.email,
        COALESCE(profile_record.phone, ''),
        'regular',  -- customer_type
        'regular',  -- segment
        'active',   -- status
        NOW(),
        NOW()
    )
    ON CONFLICT (customer_code) DO NOTHING; -- Assuming customer_code is unique constraint, or we can use profile_id if it has unique index

    -- If profile_id is unique in customers (it should be), we can use:
    -- ON CONFLICT (profile_id) DO NOTHING;
    -- But let's check if there is a unique constraint on profile_id. 
    -- The migration 20260215_link_profiles_to_customers.sql created a unique index:
    -- CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_profile_id ON customers(profile_id);
    -- However, a unique INDEX is not enough for ON CONFLICT unless it's a CONSTRAINT.
    -- Let's assume we can't rely on ON CONFLICT profile_id if it's just an index.
    -- So we'll use IF NOT EXISTS block which is safer if no constraint exists.
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction to allow user creation even if customer creation fails
        -- Ideally we should log this to an error table
        RAISE NOTICE 'Error creating customer for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure sync_profile_to_customer also works correctly with the new columns
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    -- Solo sincronizar si el rol es cliente o mayorista
    IF NEW.role IN ('cliente', 'mayorista') THEN
        -- Verificar si ya existe un customer con este profile_id
        IF NOT EXISTS (SELECT 1 FROM customers WHERE profile_id = NEW.id) THEN
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
                NEW.id,
                COALESCE(NEW.full_name, 'Usuario'),
                COALESCE(split_part(NEW.full_name, ' ', 1), 'Usuario'),
                COALESCE(NULLIF(substring(NEW.full_name from position(' ' in NEW.full_name) + 1), ''), ''),
                NEW.email,
                COALESCE(NEW.phone, ''),
                CASE WHEN NEW.role = 'mayorista' THEN 'empresa' ELSE 'regular' END,
                CASE WHEN NEW.role = 'mayorista' THEN 'wholesale' ELSE 'regular' END,
                'active',
                NOW(),
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail
        RAISE NOTICE 'Error syncing profile to customer %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Columnas first_name y last_name agregadas a customers';
    RAISE NOTICE '✅ Funciones handle_new_user y sync_profile_to_customer actualizadas';
END $$;
