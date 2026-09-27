-- ============================================================================
-- Script: Inspeccionar Todos los Roles de Usuarios
-- Descripción: Muestra una vista consolidada de los roles desde todas las fuentes
-- ============================================================================

-- 1. Vista Detallada por Usuario
SELECT 
    au.email,
    au.id as user_id,
    -- Rol en tabla user_roles (Fuente de verdad principal)
    ur.role as role_in_table,
    ur.is_active,
    -- Rol en metadata (Usado por frontend/auth)
    au.raw_user_meta_data->>'role' as role_in_metadata,
    -- Rol en perfiles (Si se usa)
    p.role as role_in_profile,
    -- Fecha de creación
    au.created_at
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
LEFT JOIN public.profiles p ON au.id = p.id
ORDER BY au.created_at DESC;

-- 2. Resumen de Conteo por Rol (Tabla user_roles)
SELECT 
    role,
    COUNT(*) as total_users
FROM public.user_roles
GROUP BY role
ORDER BY total_users DESC;

-- 3. Usuarios sin Rol en user_roles (Debería estar vacío si corriste el script anterior)
SELECT email, id 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_roles);
