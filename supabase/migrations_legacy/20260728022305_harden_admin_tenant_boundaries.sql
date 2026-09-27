-- Harden tenant boundaries discovered during the admin audit.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_branch_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.branches
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE id <> NEW.id
      AND organization_id = NEW.organization_id
      AND is_default = TRUE;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_branch_defaults() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_branch_assignments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.user_branch_assignments assignment
SET organization_id = branch.organization_id
FROM public.branches branch
WHERE branch.id = assignment.branch_id
  AND assignment.organization_id IS DISTINCT FROM branch.organization_id;

ALTER TABLE public.user_branch_assignments
  ALTER COLUMN organization_id SET NOT NULL;

DROP INDEX IF EXISTS public.idx_user_branch_assignments_primary;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_branch_assignments_primary_per_org
  ON public.user_branch_assignments(user_id, organization_id)
  WHERE is_primary = TRUE AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.normalize_primary_branch_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_organization_id UUID;
BEGIN
  SELECT organization_id
  INTO target_organization_id
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF target_organization_id IS NULL THEN
    RAISE EXCEPTION 'Branch % has no organization', NEW.branch_id;
  END IF;

  NEW.organization_id = target_organization_id;

  IF NEW.is_primary AND NEW.is_active THEN
    UPDATE public.user_branch_assignments
    SET is_primary = FALSE,
        updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND organization_id = target_organization_id
      AND id <> NEW.id
      AND is_primary = TRUE;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_primary_branch_assignment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_email TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bootstrap_first_admin'));

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role IN ('admin', 'super_admin')
      AND is_active = TRUE
  ) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role IN ('admin', 'super_admin')
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO current_email
  FROM auth.users
  WHERE id = current_user_id;

  INSERT INTO public.profiles (id, email, role, status, updated_at)
  VALUES (current_user_id, current_email, 'admin', 'active', NOW())
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      status = 'active',
      updated_at = NOW();

  INSERT INTO public.user_roles (user_id, role, is_active, updated_at)
  VALUES (current_user_id, 'admin', TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin',
      is_active = TRUE,
      updated_at = NOW();

  INSERT INTO public.audit_log (
    user_id,
    action,
    resource,
    resource_id,
    new_values,
    created_at
  )
  VALUES (
    current_user_id,
    'grant_admin_self_rpc',
    'auth',
    current_user_id::TEXT,
    jsonb_build_object('role', 'admin', 'is_first_admin', TRUE),
    NOW()
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.perform_cash_admin_action(
  p_session_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  previous_session public.cash_closures%ROWTYPE;
  updated_session public.cash_closures%ROWTYPE;
  session_organization_id UUID;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action NOT IN ('remote_close', 'suspend', 'unsuspend', 'block', 'unblock', 'reopen') THEN
    RAISE EXCEPTION 'Unsupported cash admin action';
  END IF;

  SELECT *
  INTO previous_session
  FROM public.cash_closures
  WHERE id = p_session_id
  FOR UPDATE;

  IF previous_session.id IS NULL THEN
    RAISE EXCEPTION 'Cash session not found';
  END IF;

  SELECT organization_id
  INTO session_organization_id
  FROM public.cash_closures
  WHERE id = p_session_id;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = actor_id AND role = 'super_admin' AND is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = actor_id
        AND organization_id = session_organization_id
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient organization permissions';
  END IF;

  UPDATE public.cash_closures
  SET
    status = CASE p_action
      WHEN 'remote_close' THEN 'closed'
      WHEN 'suspend' THEN 'suspended'
      WHEN 'unsuspend' THEN 'open'
      WHEN 'block' THEN 'blocked'
      WHEN 'unblock' THEN 'open'
      WHEN 'reopen' THEN 'open'
    END,
    date = CASE
      WHEN p_action = 'remote_close' THEN NOW()
      WHEN p_action = 'reopen' THEN NULL
      ELSE date
    END,
    closed_by = CASE
      WHEN p_action = 'remote_close' THEN actor_id
      WHEN p_action = 'reopen' THEN NULL
      ELSE closed_by
    END,
    suspended_by = CASE
      WHEN p_action = 'suspend' THEN actor_id
      WHEN p_action = 'unsuspend' THEN NULL
      ELSE suspended_by
    END,
    suspended_at = CASE
      WHEN p_action = 'suspend' THEN NOW()
      WHEN p_action = 'unsuspend' THEN NULL
      ELSE suspended_at
    END,
    blocked_by = CASE
      WHEN p_action = 'block' THEN actor_id
      WHEN p_action = 'unblock' THEN NULL
      ELSE blocked_by
    END,
    blocked_at = CASE
      WHEN p_action = 'block' THEN NOW()
      WHEN p_action = 'unblock' THEN NULL
      ELSE blocked_at
    END,
    updated_at = NOW()
  WHERE id = p_session_id
  RETURNING * INTO updated_session;

  INSERT INTO public.cash_admin_audit (
    session_id, register_id, action, performed_by, reason,
    previous_state, new_state, ip_address, user_agent
  )
  VALUES (
    p_session_id,
    previous_session.register_id,
    p_action,
    actor_id,
    NULLIF(BTRIM(p_reason), ''),
    to_jsonb(previous_session),
    to_jsonb(updated_session),
    inet_client_addr(),
    NULLIF(BTRIM(p_user_agent), '')
  );

  RETURN to_jsonb(updated_session);
END;
$$;

REVOKE ALL ON FUNCTION public.perform_cash_admin_action(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_cash_admin_action(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
