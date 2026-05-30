-- ============================================================================
-- Profiles RLS cleanup
-- 20260528_admin_users_org_isolation.sql added org-scoped policies but
-- did not drop several legacy permissive SELECT policies.  Because Postgres
-- ORs all permissive policies, any USING (true) policy defeats isolation.
--
-- This migration:
--   1. Drops every legacy permissive SELECT policy on profiles.
--   2. Replaces profiles_select_staff with a version that also excludes
--      super_admin profiles for non-super_admin callers.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Drop ALL legacy permissive SELECT policies not cleaned up previously
-- ---------------------------------------------------------------------------

-- USING (true) — the main culprit, any authenticated user sees everything
DROP POLICY IF EXISTS "Authenticated users can view all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles"         ON public.profiles;
DROP POLICY IF EXISTS "allow authenticated read profiles"             ON public.profiles;
DROP POLICY IF EXISTS "Perfiles públicos son legibles"                ON public.profiles;

-- Global admin/manager view (no org scope)
DROP POLICY IF EXISTS "Admins and Managers can view all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"                  ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles"                ON public.profiles;

-- Old own-profile policies (replaced by our migration's profiles_select_staff)
DROP POLICY IF EXISTS "profiles_select_own"                           ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"                    ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil"          ON public.profiles;

-- ---------------------------------------------------------------------------
-- Recreate profiles_select_staff with super_admin exclusion for non-SA callers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;

CREATE POLICY "profiles_select_staff"
ON public.profiles FOR SELECT TO authenticated
USING (
  -- Always see your own profile
  id = auth.uid()

  -- super_admin sees every profile globally
  OR public.get_jwt_role() = 'super_admin'

  -- Staff (admin/manager/etc.) sees same-org profiles,
  -- but never super_admin profiles (prevents privilege leakage)
  OR (
    public.is_staff()
    AND role <> 'super_admin'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = public.get_current_user_org_id()
    )
  )
);

-- ---------------------------------------------------------------------------
-- Data fix: remove super_admin users from organization_members
-- Super admins have global access and should not be scoped to any org.
-- ---------------------------------------------------------------------------

DELETE FROM public.organization_members
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE role = 'super_admin'
);

COMMIT;
