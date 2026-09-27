-- ============================================================================
-- Admin Users: Multi-tenant isolation for /admin/users
-- ============================================================================
-- Fixes:
--   1. profiles RLS policies scoped to organization_members
--   2. get_user_stats() org-scoped (non-super_admin only sees own org)
--   3. search_users() org-scoped
--   4. get_user_activity() org membership check before returning data
--   5. get_user_permissions() org membership check before returning data
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: resolve caller's primary organization (STABLE = cached per query)
-- SECURITY DEFINER to avoid RLS recursion when called from a policy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Fix profiles RLS policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_staff"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin"     ON public.profiles;

-- SELECT: own profile always + super_admin global + staff sees same-org profiles
CREATE POLICY "profiles_select_staff"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.get_jwt_role() = 'super_admin'
  OR (
    public.is_staff()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = public.get_current_user_org_id()
    )
  )
);

-- UPDATE: own profile + super_admin + admin scoped to same org
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR public.get_jwt_role() = 'super_admin'
  OR (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = public.get_current_user_org_id()
    )
  )
)
WITH CHECK (
  id = auth.uid()
  OR public.get_jwt_role() = 'super_admin'
  OR (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = public.get_current_user_org_id()
    )
  )
);

-- INSERT: admin can insert (new user not yet in org_members at insert time)
CREATE POLICY "profiles_insert_admin"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  public.get_jwt_role() = 'super_admin'
  OR public.is_admin()
);

-- DELETE: super_admin or admin scoped to same org
CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE TO authenticated
USING (
  public.get_jwt_role() = 'super_admin'
  OR (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = public.get_current_user_org_id()
    )
  )
);

-- ---------------------------------------------------------------------------
-- get_user_stats() — org-scoped for non-super_admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_stats(p_organization_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_org_id uuid;
BEGIN
  IF public.get_jwt_role() <> 'super_admin' THEN
    v_org_id := COALESCE(p_organization_id, public.get_current_user_org_id());
  ELSE
    v_org_id := p_organization_id;
  END IF;

  IF v_org_id IS NOT NULL THEN
    SELECT json_build_object(
      'totalUsers',        COUNT(*),
      'activeUsers',       COUNT(*) FILTER (WHERE status = 'active'),
      'inactiveUsers',     COUNT(*) FILTER (WHERE status = 'inactive'),
      'suspendedUsers',    COUNT(*) FILTER (WHERE status = 'suspended'),
      'adminsCount',       COUNT(*) FILTER (WHERE role = 'admin'),
      'techsCount',        COUNT(*) FILTER (WHERE role = 'tecnico'),
      'sellersCount',      COUNT(*) FILTER (WHERE role = 'vendedor'),
      'clientsCount',      COUNT(*) FILTER (WHERE role = 'cliente'),
      'newUsersThisMonth', COUNT(*) FILTER (
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      ),
      'newUsersThisWeek',  COUNT(*) FILTER (
        WHERE created_at >= date_trunc('week', CURRENT_DATE)
      ),
      'activeToday',       COUNT(*) FILTER (
        WHERE updated_at >= CURRENT_DATE
      )
    ) INTO result
    FROM profiles
    WHERE id IN (
      SELECT user_id FROM organization_members WHERE organization_id = v_org_id
    );
  ELSE
    -- super_admin global view
    SELECT json_build_object(
      'totalUsers',        COUNT(*),
      'activeUsers',       COUNT(*) FILTER (WHERE status = 'active'),
      'inactiveUsers',     COUNT(*) FILTER (WHERE status = 'inactive'),
      'suspendedUsers',    COUNT(*) FILTER (WHERE status = 'suspended'),
      'adminsCount',       COUNT(*) FILTER (WHERE role IN ('admin', 'super_admin')),
      'techsCount',        COUNT(*) FILTER (WHERE role = 'tecnico'),
      'sellersCount',      COUNT(*) FILTER (WHERE role = 'vendedor'),
      'clientsCount',      COUNT(*) FILTER (WHERE role = 'cliente'),
      'newUsersThisMonth', COUNT(*) FILTER (
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      ),
      'newUsersThisWeek',  COUNT(*) FILTER (
        WHERE created_at >= date_trunc('week', CURRENT_DATE)
      ),
      'activeToday',       COUNT(*) FILTER (
        WHERE updated_at >= CURRENT_DATE
      )
    ) INTO result
    FROM profiles;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- search_users() — org-scoped for non-super_admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_users(
  p_search_term      text       DEFAULT NULL,
  p_role             text       DEFAULT NULL,
  p_status           text       DEFAULT NULL,
  p_department       text       DEFAULT NULL,
  p_date_from        timestamptz DEFAULT NULL,
  p_date_to          timestamptz DEFAULT NULL,
  p_limit            int        DEFAULT 10,
  p_offset           int        DEFAULT 0,
  p_organization_id  uuid       DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  full_name    text,
  email        text,
  role         text,
  status       text,
  department   text,
  phone        text,
  avatar_url   text,
  created_at   timestamptz,
  updated_at   timestamptz,
  total_count  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF public.get_jwt_role() <> 'super_admin' THEN
    v_org_id := COALESCE(p_organization_id, public.get_current_user_org_id());
  ELSE
    v_org_id := p_organization_id;
  END IF;

  RETURN QUERY
  WITH org_user_ids AS (
    SELECT user_id FROM organization_members
    WHERE v_org_id IS NULL OR organization_id = v_org_id
  ),
  base AS (
    SELECT p.id, p.full_name, p.email, p.role, p.status,
           p.department, p.phone, p.avatar_url, p.created_at, p.updated_at
    FROM profiles p
    WHERE p.id IN (SELECT user_id FROM org_user_ids)
      AND (p_search_term IS NULL OR (
            p.full_name ILIKE '%' || p_search_term || '%'
         OR p.email     ILIKE '%' || p_search_term || '%'
         OR p.phone     ILIKE '%' || p_search_term || '%'
      ))
      AND (p_role       IS NULL OR p.role       = p_role)
      AND (p_status     IS NULL OR p.status     = p_status)
      AND (p_department IS NULL OR p.department = p_department)
      AND (p_date_from  IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to    IS NULL OR p.created_at <= p_date_to)
  ),
  paged AS (SELECT * FROM base ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset),
  total AS (SELECT COUNT(*) AS cnt FROM base)
  SELECT paged.*, total.cnt FROM paged CROSS JOIN total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(text, text, text, text, timestamptz, timestamptz, int, int, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_user_activity() — org membership check before returning audit data
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_activity(
  p_user_id uuid,
  p_limit   int DEFAULT 50
)
RETURNS TABLE (
  id          uuid,
  action      text,
  resource    text,
  resource_id text,
  details     jsonb,
  created_at  timestamptz,
  ip_address  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_jwt_role() <> 'super_admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id       = p_user_id
        AND organization_id = public.get_current_user_org_id()
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT al.id, al.action, al.resource, al.resource_id,
         al.new_values AS details, al.created_at, al.ip_address
  FROM audit_log al
  WHERE al.user_id = p_user_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_activity(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_user_permissions() — org membership check before returning data
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role   text;
  permissions jsonb;
BEGIN
  IF public.get_jwt_role() <> 'super_admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id       = p_user_id
        AND organization_id = public.get_current_user_org_id()
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT role INTO user_role FROM profiles WHERE id = p_user_id;

  permissions := CASE user_role
    WHEN 'admin' THEN jsonb_build_object(
      'users',    jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', true),
      'products', jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', true),
      'sales',    jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', true),
      'repairs',  jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', true),
      'reports',  jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', true),
      'settings', jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', true)
    )
    WHEN 'vendedor' THEN jsonb_build_object(
      'users',    jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'products', jsonb_build_object('create', false, 'read', true,  'update', false, 'delete', false),
      'sales',    jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', false),
      'repairs',  jsonb_build_object('create', false, 'read', true,  'update', false, 'delete', false),
      'reports',  jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false)
    )
    WHEN 'tecnico' THEN jsonb_build_object(
      'users',    jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'products', jsonb_build_object('create', false, 'read', true,  'update', false, 'delete', false),
      'sales',    jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'repairs',  jsonb_build_object('create', true,  'read', true,  'update', true,  'delete', false),
      'reports',  jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false)
    )
    ELSE jsonb_build_object(
      'users',    jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'products', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'sales',    jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'repairs',  jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'reports',  jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false),
      'settings', jsonb_build_object('create', false, 'read', false, 'update', false, 'delete', false)
    )
  END;

  RETURN permissions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- user_roles RLS — org-scoped for admin (super_admin keeps global view)
-- ---------------------------------------------------------------------------

-- Keep own-role view as-is (no org check needed)
-- Scope admin view/manage to same-org users only

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_jwt_role() = 'super_admin'
    OR (
      public.has_permission('users.read')
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = user_roles.user_id
          AND om.organization_id = public.get_current_user_org_id()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.get_jwt_role() = 'super_admin'
    OR (
      public.has_permission('users.manage')
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = user_roles.user_id
          AND om.organization_id = public.get_current_user_org_id()
      )
    )
  );

COMMIT;
