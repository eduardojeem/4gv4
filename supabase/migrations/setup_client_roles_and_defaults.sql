-- ============================================================================
-- Script: Configuración de Roles de Cliente y Default
-- Descripción: 
-- 1. Actualiza los roles permitidos (incluyendo clientes normal y mayorista)
-- 2. Configura trigger para asignar rol por defecto al registrarse
-- 3. Asigna rol por defecto a usuarios existentes sin rol
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTUALIZAR CONSTRAINT DE ROLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- LIMPIEZA DE ROLES: Migrar cualquier rol desconocido a 'client_normal' para evitar errores
UPDATE public.user_roles
SET role = 'client_normal'
WHERE role NOT IN (
    'super_admin', 
    'admin', 
    'manager', 
    'employee', 
    'viewer', 
    'technician', 
    'vendedor',
    'client_normal',
    'client_mayorista'
);

-- Definimos todos los roles posibles del sistema
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN (
    'super_admin', 
    'admin', 
    'manager', 
    'employee', 
    'viewer', 
    'technician', 
    'vendedor',
    'client_normal',    -- Cliente Normal (Default)
    'client_mayorista'  -- Cliente Mayorista
));

-- ----------------------------------------------------------------------------
-- 2. FUNCIÓN Y TRIGGER PARA NUEVOS USUARIOS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_role() 
RETURNS TRIGGER 
SET search_path = public
AS $$
DECLARE
    default_role TEXT := 'client_normal';
BEGIN
    -- 1. Insertar en user_roles
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (new.id, default_role, TRUE)
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. Asegurar que el metadata tenga el rol
    -- Esto es útil para el frontend
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(default_role)
    )
    WHERE id = new.id;

    -- 3. Crear entrada en profiles si existe la tabla y no tiene entrada
    -- (Asumiendo que profiles tiene columnas id, email, role)
    BEGIN
        INSERT INTO public.profiles (id, email, role)
        VALUES (new.id, new.email, default_role)
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role
        WHERE profiles.role IS NULL;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar error si la tabla profiles no tiene esa estructura exacta
        -- o si ya existe otro trigger manejando profiles
        NULL;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger anterior si existe para evitar duplicados
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Crear el trigger que se ejecuta CADA VEZ que se crea un usuario
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ----------------------------------------------------------------------------
-- 3. BACKFILL (RELLENAR) USUARIOS EXISTENTES SIN ROL
-- ----------------------------------------------------------------------------

-- Insertar rol 'client_normal' para usuarios que no están en user_roles
INSERT INTO public.user_roles (user_id, role, is_active)
SELECT id, 'client_normal', TRUE
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);

-- Actualizar metadata para usuarios que no tienen 'role' en metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"client_normal"'
)
WHERE raw_user_meta_data->>'role' IS NULL;

-- Actualizar profiles para usuarios que tengan role NULL (si aplica)
-- UPDATE public.profiles SET role = 'client_normal' WHERE role IS NULL;

-- ----------------------------------------------------------------------------
-- 4. VERIFICACIÓN
-- ----------------------------------------------------------------------------
SELECT 
    role, 
    COUNT(*) as total_users 
FROM public.user_roles 
GROUP BY role;
