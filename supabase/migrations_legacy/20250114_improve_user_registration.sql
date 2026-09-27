-- Mejorar la función de registro de usuarios para asegurar que siempre se asigne el rol de cliente

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    -- Crear perfil con rol de cliente por defecto
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
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comentario
COMMENT ON FUNCTION public.handle_new_user() IS 'Crea automáticamente un perfil con rol de cliente cuando se registra un nuevo usuario';
