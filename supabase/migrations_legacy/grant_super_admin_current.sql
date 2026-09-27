-- Asignar super admin al usuario con email conocido
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower('jeem101595@gmail.com');

  IF target_user_id IS NOT NULL THEN
    -- Upsert rol en user_roles
    INSERT INTO public.user_roles(user_id, role, is_active, updated_at)
    VALUES (target_user_id, 'admin', TRUE, NOW())
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = TRUE, updated_at = EXCLUDED.updated_at;

    -- Upsert rol UI en profiles
    INSERT INTO public.profiles(id, role, full_name, updated_at)
    VALUES (target_user_id, 'admin', 'Super Admin', NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = EXCLUDED.updated_at;

    -- Auditoría
    INSERT INTO public.audit_log(user_id, action, resource, resource_id, new_values)
    VALUES (target_user_id, 'grant_admin_migration', 'auth', target_user_id::text, '{"role_ui":"admin","role_db":"admin"}'::jsonb);
  END IF;
END $$;
