CREATE OR REPLACE FUNCTION public.promote_current_user_to_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_roles(user_id, role, is_active, updated_at)
  VALUES (uid, 'admin', TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = TRUE, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.profiles(id, role, updated_at)
  VALUES (uid, 'admin', NOW())
  ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = EXCLUDED.updated_at;

  INSERT INTO public.audit_log(user_id, action, resource, resource_id, new_values)
  VALUES (uid, 'grant_admin_self_rpc', 'auth', uid::text, '{"role_ui":"admin","role_db":"admin"}'::jsonb);

  RETURN TRUE;
END;
$$;

