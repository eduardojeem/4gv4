-- ============================================================================
-- Script: Agregar rol de técnico - VERSIÓN MEJORADA
-- Descripción: Investiga roles existentes y actualiza constraint apropiadamente
-- ============================================================================

-- PASO 1: Ver qué roles existen actualmente en la tabla
SELECT DISTINCT role, COUNT(*) as count
FROM public.user_roles
GROUP BY role;

-- PASO 2: Ver el constraint actual
SELECT conname, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'user_roles_role_check';

-- PASO 3: Eliminar el constraint existente
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- PASO 4: Crear nuevo constraint más permisivo que incluye todos los roles necesarios
-- Incluye: super_admin, admin, manager, employee, viewer, technician, vendedor
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
    'sales',
    'support',
    'developer'
));

-- PASO 5: Verificar si el usuario existe
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'johneduardoespinoza95@gmail.com';

-- PASO 6: Insertar o actualizar el rol en la tabla user_roles
INSERT INTO public.user_roles (user_id, role, is_active)
SELECT 
    id,
    'technician',
    TRUE
FROM auth.users
WHERE email = 'johneduardoespinoza95@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
    role = 'technician',
    is_active = TRUE,
    updated_at = NOW();

-- PASO 7: Actualizar metadata del usuario en auth
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"technician"'
)
WHERE email = 'johneduardoespinoza95@gmail.com';

-- PASO 8: Si existe tabla profiles, actualizar ahí también
UPDATE public.profiles
SET role = 'technician'
WHERE email = 'johneduardoespinoza95@gmail.com';

-- PASO 9: Verificación final
SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'role' as metadata_role,
    ur.role as user_roles_role,
    ur.is_active,
    p.role as profiles_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'johneduardoespinoza95@gmail.com';

-- ============================================================================
-- NOTA: Si aún hay error, ejecuta primero solo los PASOS 1 y 2 para ver
-- qué roles existen y luego ajusta el constraint en el PASO 4
-- ============================================================================
