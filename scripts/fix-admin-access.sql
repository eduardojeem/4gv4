-- ============================================================
-- DIAGNÃ“STICO Y FIX: Acceso admin bloqueado
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- PASO 1: DIAGNÃ“STICO COMPLETO
-- ReemplazÃ¡ 'email-del-admin@ejemplo.com' con el email real
-- ============================================================
SELECT
  u.id,
  u.email,
  u.created_at,
  ur.role            AS user_roles_role,
  ur.is_active       AS user_roles_is_active,
  p.role             AS profiles_role,
  p.status           AS profiles_status,
  u.raw_app_meta_data->>'role' AS app_metadata_role
FROM auth.users u
LEFT JOIN public.user_roles ur  ON ur.user_id = u.id
LEFT JOIN public.profiles p     ON p.id = u.id
WHERE u.email = 'admin@example.com';

-- ============================================================
-- PASO 2: INTERPRETÃ EL RESULTADO
--
-- CASO A â†’ user_roles_role es NULL
--   El usuario no tiene fila en user_roles. EjecutÃ¡ el PASO 3A.
--
-- CASO B â†’ user_roles_role = 'admin' pero is_active = false
--   El rol existe pero estÃ¡ desactivado. EjecutÃ¡ el PASO 3B.
--
-- CASO C â†’ user_roles_role = 'admin' pero profiles_status = 'inactive' o 'suspended'
--   El perfil estÃ¡ bloqueado. EjecutÃ¡ el PASO 3C.
--
-- CASO D â†’ user_roles_role tiene un valor distinto ('manager', 'employee', etc.)
--   El rol no es reconocido como admin. EjecutÃ¡ el PASO 3D.
--
-- CASO E â†’ Todo parece correcto pero igual no entra
--   Problema de RLS o polÃ­ticas. EjecutÃ¡ el PASO 4.
-- ============================================================


-- ============================================================
-- PASO 3A: Insertar rol admin en user_roles (CASO A)
-- ============================================================
INSERT INTO public.user_roles (user_id, role, is_active, created_at, updated_at)
SELECT
  id,
  'admin',
  true,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (user_id) DO UPDATE
  SET role      = 'admin',
      is_active = true,
      updated_at = NOW();


-- ============================================================
-- PASO 3B: Reactivar rol desactivado (CASO B)
-- ============================================================
UPDATE public.user_roles
SET is_active  = true,
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@example.com'
);


-- ============================================================
-- PASO 3C: Reactivar perfil suspendido/inactivo (CASO C)
-- ============================================================
UPDATE public.profiles
SET status     = 'active',
    updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@example.com'
);


-- ============================================================
-- PASO 3D: Corregir rol incorrecto (CASO D)
-- ============================================================
UPDATE public.user_roles
SET role       = 'admin',
    is_active  = true,
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@example.com'
);

-- Sincronizar tambiÃ©n en profiles
UPDATE public.profiles
SET role       = 'admin',
    updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@example.com'
);


-- ============================================================
-- PASO 4: VERIFICAR POLÃTICAS RLS (CASO E)
-- Si los pasos anteriores no resuelven el problema,
-- verificÃ¡ que las polÃ­ticas de user_roles permitan
-- que el usuario lea su propio rol.
-- ============================================================

-- Ver polÃ­ticas activas en user_roles
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_roles' AND schemaname = 'public';

-- Si no existe la polÃ­tica "Users can view own role", crearla:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles'
      AND schemaname = 'public'
      AND policyname = 'Users can view own role'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own role" ON public.user_roles
        FOR SELECT TO authenticated
        USING (user_id = auth.uid())
    $policy$;
    RAISE NOTICE 'PolÃ­tica creada: Users can view own role';
  ELSE
    RAISE NOTICE 'La polÃ­tica ya existe';
  END IF;
END $$;


-- ============================================================
-- PASO 5: VERIFICACIÃ“N FINAL
-- CorrÃ© esto despuÃ©s de aplicar el fix para confirmar
-- ============================================================
SELECT
  u.email,
  ur.role            AS user_roles_role,
  ur.is_active       AS user_roles_is_active,
  p.role             AS profiles_role,
  p.status           AS profiles_status,
  CASE
    WHEN ur.role IN ('admin','super_admin') AND ur.is_active = true AND COALESCE(p.status,'active') = 'active'
    THEN 'âœ… ACCESO CORRECTO'
    WHEN ur.role IS NULL
    THEN 'âŒ SIN ROL EN user_roles'
    WHEN ur.is_active = false
    THEN 'âŒ ROL DESACTIVADO'
    WHEN p.status IN ('inactive','suspended')
    THEN 'âŒ PERFIL BLOQUEADO'
    WHEN ur.role NOT IN ('admin','super_admin')
    THEN 'âŒ ROL NO ES ADMIN: ' || ur.role
    ELSE 'âš ï¸ REVISAR MANUALMENTE'
  END AS diagnostico
FROM auth.users u
LEFT JOIN public.user_roles ur  ON ur.user_id = u.id
LEFT JOIN public.profiles p     ON p.id = u.id
WHERE u.email = 'admin@example.com';
