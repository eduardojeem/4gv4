-- Reconcile Security Advisor findings caused by historical grants and policies.
-- This migration is intentionally idempotent because some objects were created
-- outside the primary Supabase migration directory.

BEGIN;

-- New functions must opt in to Data API execution explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Remove anonymous access inherited from PUBLIC while preserving the
-- authenticated RPCs that validate auth.uid() and organization permissions.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.app_can_view_cost()',
    'public.close_all_user_sessions_except_current(uuid,text)',
    'public.close_user_session(text,uuid)',
    'public.get_index_stats()',
    'public.get_user_active_sessions(uuid)',
    'public.get_user_activity(uuid,integer)',
    'public.has_org_permission(uuid,text)',
    'public.pos_decrement_stock(uuid,integer)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
  END LOOP;
END;
$$;

-- Cron/maintenance functions and trigger helpers must never be callable by
-- browser-facing roles. Triggers continue to execute without these grants.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.cash_set_org_from_membership()',
    'public.downgrade_overdue_accounts()',
    'public.ensure_branch_inventory_tenant_match()',
    'public.expire_stale_orders()',
    'public.perform_maintenance_task(text)',
    'public.record_database_growth_snapshot()',
    'public.refresh_organization_review_stats()'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        fn
      );
    END IF;
  END LOOP;
END;
$$;

-- Preserve service execution for scheduled and server-only operations.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.downgrade_overdue_accounts()',
    'public.expire_stale_orders()',
    'public.perform_maintenance_task(text)',
    'public.record_database_growth_snapshot()'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END;
$$;

-- Pin the resolution path without redefining functions whose bodies differ
-- between historical installations.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_default_dashboard_organization()',
    'public.set_audit_log_organization_id()',
    'public.update_updated_at_column()',
    'public.refresh_organization_review_stats()'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = pg_catalog, public',
        fn
      );
    END IF;
  END LOOP;
END;
$$;

-- Audit rows written with a user session must be attributed to that user and,
-- when organization-scoped, to one of their active organizations.
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can insert audit logs"
      ON public.audit_log;
    DROP POLICY IF EXISTS "Allow audit log insertion"
      ON public.audit_log;
    DROP POLICY IF EXISTS "Authenticated users can insert own audit logs"
      ON public.audit_log;

    CREATE POLICY "Authenticated users can insert own audit logs"
      ON public.audit_log
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = (SELECT auth.uid())
        AND (
          organization_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.organization_members AS membership
            WHERE membership.organization_id = audit_log.organization_id
              AND membership.user_id = (SELECT auth.uid())
              AND membership.status = 'active'
          )
        )
      );
  END IF;
END;
$$;

-- Public reviews are accepted only through the rate-limited server endpoint,
-- which uses service_role and fixes the tenant and moderation fields.
DO $$
BEGIN
  IF to_regclass('public.organization_reviews') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can submit a review"
      ON public.organization_reviews;
  END IF;
END;
$$;

-- A public bucket already serves files through public object URLs. Broad
-- SELECT policies only add object-listing access and are unnecessary.
DROP POLICY IF EXISTS "Acceso publico a avatares" ON storage.objects;
DROP POLICY IF EXISTS "Acceso público a avatares" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Consolidate historical avatar write policies into one owner-path contract.
DROP POLICY IF EXISTS "Authenticated Users Upload Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden subir su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can read object metadata" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can delete" ON storage.objects;

CREATE POLICY "Avatar owners can read object metadata"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND storage.allow_any_operation(
      ARRAY['object.get_authenticated_info', 'object.get_authenticated']
    )
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS actor
        JOIN public.organization_members AS target
          ON target.organization_id = actor.organization_id
        WHERE actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('owner', 'admin')
          AND target.user_id::TEXT = (storage.foldername(name))[1]
          AND target.status = 'active'
      )
    )
  );

CREATE POLICY "Avatar owners can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS actor
        JOIN public.organization_members AS target
          ON target.organization_id = actor.organization_id
        WHERE actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('owner', 'admin')
          AND target.user_id::TEXT = (storage.foldername(name))[1]
          AND target.status = 'active'
      )
    )
  );

CREATE POLICY "Avatar owners can update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS actor
        JOIN public.organization_members AS target
          ON target.organization_id = actor.organization_id
        WHERE actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('owner', 'admin')
          AND target.user_id::TEXT = (storage.foldername(name))[1]
          AND target.status = 'active'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS actor
        JOIN public.organization_members AS target
          ON target.organization_id = actor.organization_id
        WHERE actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('owner', 'admin')
          AND target.user_id::TEXT = (storage.foldername(name))[1]
          AND target.status = 'active'
      )
    )
  );

CREATE POLICY "Avatar owners can delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS actor
        JOIN public.organization_members AS target
          ON target.organization_id = actor.organization_id
        WHERE actor.user_id = (SELECT auth.uid())
          AND actor.status = 'active'
          AND actor.role IN ('owner', 'admin')
          AND target.user_id::TEXT = (storage.foldername(name))[1]
          AND target.status = 'active'
      )
    )
  );

COMMIT;
