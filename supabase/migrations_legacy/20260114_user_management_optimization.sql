-- =====================================================
-- OPTIMIZACIÓN DE GESTIÓN DE USUARIOS
-- =====================================================
-- Fecha: 2026-01-14
-- Descripción: Funciones y optimizaciones para mejorar
--              el rendimiento de la sección /admin/users
-- =====================================================

-- 1. Función para obtener estadísticas globales de usuarios
-- =====================================================
-- SECURITY DEFINER permite que la función ejecute con permisos del creador
-- evitando problemas de RLS al consultar la tabla profiles
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalUsers', COUNT(*),
    'activeUsers', COUNT(*) FILTER (WHERE status = 'active'),
    'inactiveUsers', COUNT(*) FILTER (WHERE status = 'inactive'),
    'suspendedUsers', COUNT(*) FILTER (WHERE status = 'suspended'),
    'adminsCount', COUNT(*) FILTER (WHERE role = 'admin'),
    'supervisorsCount', COUNT(*) FILTER (WHERE role = 'supervisor'),
    'techsCount', COUNT(*) FILTER (WHERE role = 'tecnico'),
    'sellersCount', COUNT(*) FILTER (WHERE role = 'vendedor'),
    'clientsCount', COUNT(*) FILTER (WHERE role = 'cliente'),
    'newUsersThisMonth', COUNT(*) FILTER (
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'newUsersThisWeek', COUNT(*) FILTER (
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
    ),
    'activeToday', COUNT(*) FILTER (
      WHERE updated_at >= CURRENT_DATE
    )
  ) INTO result
  FROM profiles;
  
  RETURN result;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION get_user_stats() IS 
'Retorna estadísticas globales de usuarios de forma eficiente usando agregaciones SQL';

-- 2. Función para búsqueda avanzada de usuarios
-- =====================================================
-- SECURITY DEFINER permite bypass de RLS para búsqueda eficiente
CREATE OR REPLACE FUNCTION search_users(
  p_search_term text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text,
  status text,
  department text,
  phone text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_users AS (
    SELECT 
      p.id,
      p.full_name,
      p.email,
      p.role,
      p.status,
      p.department,
      p.phone,
      p.avatar_url,
      p.created_at,
      p.updated_at
    FROM profiles p
    WHERE 
      (p_search_term IS NULL OR (
        p.full_name ILIKE '%' || p_search_term || '%' OR
        p.email ILIKE '%' || p_search_term || '%' OR
        p.phone ILIKE '%' || p_search_term || '%' OR
        p.department ILIKE '%' || p_search_term || '%'
      ))
      AND (p_role IS NULL OR p.role = p_role)
      AND (p_status IS NULL OR p.status = p_status)
      AND (p_department IS NULL OR p.department = p_department)
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ),
  total AS (
    SELECT COUNT(*) as cnt
    FROM profiles p
    WHERE 
      (p_search_term IS NULL OR (
        p.full_name ILIKE '%' || p_search_term || '%' OR
        p.email ILIKE '%' || p_search_term || '%' OR
        p.phone ILIKE '%' || p_search_term || '%' OR
        p.department ILIKE '%' || p_search_term || '%'
      ))
      AND (p_role IS NULL OR p.role = p_role)
      AND (p_status IS NULL OR p.status = p_status)
      AND (p_department IS NULL OR p.department = p_department)
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at <= p_date_to)
  )
  SELECT 
    fu.*,
    t.cnt as total_count
  FROM filtered_users fu
  CROSS JOIN total t;
END;
$$;

COMMENT ON FUNCTION search_users IS 
'Búsqueda avanzada de usuarios con filtros múltiples y paginación optimizada';

-- 3. Función para obtener actividad reciente de un usuario
-- =====================================================
-- SECURITY DEFINER permite acceso a audit_log sin problemas de RLS
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id uuid,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  action text,
  resource text,
  resource_id text,
  details jsonb,
  created_at timestamptz,
  ip_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.resource,
    al.resource_id,
    al.new_values as details,
    al.created_at,
    al.ip_address
  FROM audit_log al
  WHERE al.user_id = p_user_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_user_activity IS 
'Retorna el historial de actividad de un usuario específico';

-- 4. Función para validar email único
-- =====================================================
-- SECURITY DEFINER permite verificar emails sin exponer datos sensibles
CREATE OR REPLACE FUNCTION is_email_available(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE email = p_email
  ) INTO email_exists;
  
  RETURN NOT email_exists;
END;
$$;

COMMENT ON FUNCTION is_email_available IS 
'Verifica si un email está disponible para registro';

-- 5. Función para obtener permisos de un usuario según su rol
-- =====================================================
-- SECURITY DEFINER permite consultar rol sin problemas de RLS
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  permissions jsonb;
BEGIN
  -- Obtener el rol del usuario
  SELECT role INTO user_role
  FROM profiles
  WHERE id = p_user_id;
  
  -- Definir permisos según el rol
  permissions := CASE user_role
    WHEN 'admin' THEN jsonb_build_object(
      'users', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'products', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'sales', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'repairs', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'reports', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true),
      'settings', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', true)
    )
    WHEN 'supervisor' THEN jsonb_build_object(
      'users', jsonb_build_object('create', false, 'read', true, 'update', true, 'delete', false),
      'products', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', false),
      'sales', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', false),
      'repairs', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', false),
      'reports', jsonb_build_object('create', false, 'read', true, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', true, 'update', false, 'delete', false)
    )
    WHEN 'vendedor' THEN jsonb_build_object(
      'users', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'products', jsonb_build_object('create', false, 'read', true, 'update', false, 'delete', false),
      'sales', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', false),
      'repairs', jsonb_build_object('create', false, 'read', true, 'update', false, 'delete', false),
      'reports', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false)
    )
    WHEN 'tecnico' THEN jsonb_build_object(
      'users', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'products', jsonb_build_object('create', false, 'read', true, 'update', false, 'delete', false),
      'sales', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'repairs', jsonb_build_object('create', true, 'read', true, 'update', true, 'delete', false),
      'reports', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false)
    )
    ELSE jsonb_build_object(
      'users', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'products', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'sales', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'repairs', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'reports', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false)
    )
  END;
  
  RETURN permissions;
END;
$$;

COMMENT ON FUNCTION get_user_permissions IS 
'Retorna los permisos detallados de un usuario según su rol';

-- 6. Índices para optimizar consultas
-- =====================================================

-- Índice para búsqueda por email (si no existe)
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower 
ON profiles (LOWER(email));

-- Índice para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm 
ON profiles USING gin (full_name gin_trgm_ops);

-- Índice para filtros por rol y estado
CREATE INDEX IF NOT EXISTS idx_profiles_role_status 
ON profiles (role, status);

-- Índice para filtros por fecha
CREATE INDEX IF NOT EXISTS idx_profiles_created_at 
ON profiles (created_at DESC);

-- Índice para departamento
CREATE INDEX IF NOT EXISTS idx_profiles_department 
ON profiles (department) WHERE department IS NOT NULL;

-- Índice compuesto para consultas comunes
CREATE INDEX IF NOT EXISTS idx_profiles_status_role_created 
ON profiles (status, role, created_at DESC);

-- 7. Políticas RLS actualizadas
-- =====================================================

-- NOTA: Las políticas RLS ya existen en migraciones anteriores
-- No las recreamos aquí para evitar recursión infinita
-- Las políticas existentes son suficientes:
-- - "Users can view own profile" - Usuarios ven su propio perfil
-- - "Users can update own profile" - Usuarios actualizan su propio perfil
-- - "Authenticated users can view profiles" - Usuarios autenticados ven perfiles
-- - Políticas de admin manejadas por funciones is_admin() o is_staff()

-- Si necesitas políticas específicas, usa las funciones helper existentes
-- en lugar de consultar directamente la tabla profiles dentro de las políticas

-- 8. Trigger para actualizar updated_at automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 9. Vista materializada para estadísticas (opcional, para alta carga)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS user_stats_cache;
CREATE MATERIALIZED VIEW user_stats_cache AS
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE status = 'active') as active_users,
  COUNT(*) FILTER (WHERE status = 'inactive') as inactive_users,
  COUNT(*) FILTER (WHERE role = 'admin') as admins_count,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_users_this_month,
  MAX(updated_at) as last_update
FROM profiles;

-- Índice en la vista materializada
CREATE UNIQUE INDEX ON user_stats_cache ((true));

-- Función para refrescar la vista materializada
-- SECURITY DEFINER permite refrescar la vista sin permisos especiales
CREATE OR REPLACE FUNCTION refresh_user_stats_cache()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats_cache;
END;
$$;

COMMENT ON FUNCTION refresh_user_stats_cache IS 
'Refresca la caché de estadísticas de usuarios (ejecutar periódicamente)';

-- 10. Grants de permisos
-- =====================================================
GRANT EXECUTE ON FUNCTION get_user_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION search_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;
GRANT EXECUTE ON FUNCTION is_email_available TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_stats_cache TO authenticated;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
