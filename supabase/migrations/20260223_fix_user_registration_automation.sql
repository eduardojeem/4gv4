-- Fix user registration automation to create customer record automatically
-- This migration ensures that when a user registers, they are added to both profiles and customers tables

-- Update the handle_new_user function to create both profile and customer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SET search_path = public
AS $$
DECLARE
    profile_record RECORD;
BEGIN
    -- Create profile with role 'cliente' by default
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'cliente'::user_role
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW()
    RETURNING * INTO profile_record;
    
    -- Now create customer record for the new profile
    -- Check if customer already exists to avoid duplicates
    IF NOT EXISTS (SELECT 1 FROM customers WHERE profile_id = profile_record.id) THEN
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
            COALESCE(split_part(profile_record.full_name, ' ', 1), 'Usuario'),
            COALESCE(NULLIF(substring(profile_record.full_name from position(' ' in profile_record.full_name) + 1), ''), ''),
            profile_record.email,
            COALESCE(profile_record.phone, ''),
            'regular',  -- customer_type
            'regular',  -- segment
            'active',   -- status
            NOW(),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also ensure the sync trigger is in place for updates
DROP TRIGGER IF EXISTS on_profile_sync_customer ON profiles;
CREATE TRIGGER on_profile_sync_customer
    AFTER INSERT OR UPDATE OF role, full_name, email, phone ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_to_customer();

-- Grant necessary permissions to ensure the function can execute properly
GRANT INSERT ON customers TO authenticated;
GRANT SELECT ON customers TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Crea automáticamente un perfil y cliente cuando se registra un nuevo usuario';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Función de registro de usuario actualizada exitosamente!';
    RAISE NOTICE '👤 Ahora los nuevos usuarios se agregan automáticamente a clientes';
    RAISE NOTICE '🔗 Sincronización entre perfiles y clientes habilitada';
END $$;