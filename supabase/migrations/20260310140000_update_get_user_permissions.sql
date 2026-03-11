-- ============================================================================
-- Replace get_user_permissions with canonical role + explicit perms merge
-- Fecha: 2026-03-10
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text; -- Renamed to avoid ambiguity with column names
  perms jsonb := '{}'::jsonb;
  perm_row record;
  res text;
  act text;
  parts text[];
BEGIN
  -- Source of truth: user_roles (active row). Fallback to profiles for legacy.
  -- We need to be careful about column ambiguity if user_roles has a column named 'role'
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
    AND (is_active IS NULL OR is_active = true)
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role INTO v_role FROM profiles WHERE id = p_user_id LIMIT 1;
  END IF;

  v_role := coalesce(v_role, 'cliente');

  -- Base permissions per canonical role
  IF v_role = 'super_admin' OR v_role = 'admin' THEN
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'products',    jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'inventory',   jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'reports',     jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'settings',    jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'promotions',  jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'sales',       jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true),
      'repairs',     jsonb_build_object('create',true,'read',true,'update',true,'delete',true,'manage',true)
    );
  ELSIF v_role = 'vendedor' THEN
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'products',    jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false),
      'inventory',   jsonb_build_object('create',false,'read',true,'update',true,'delete',false,'manage',false),
      'reports',     jsonb_build_object('create',true,'read',true,'update',false,'delete',false,'manage',false),
      'settings',    jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'promotions',  jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false),
      'sales',       jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false),
      'repairs',     jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false)
    );
  ELSIF v_role = 'tecnico' THEN
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'products',    jsonb_build_object('create',false,'read',true,'update',true,'delete',false,'manage',false),
      'inventory',   jsonb_build_object('create',false,'read',true,'update',true,'delete',false,'manage',false),
      'reports',     jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'settings',    jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'promotions',  jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'sales',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'repairs',     jsonb_build_object('create',true,'read',true,'update',true,'delete',false,'manage',false)
    );
  ELSE
    -- cliente (default)
    perms := jsonb_build_object(
      'users',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'products',    jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'inventory',   jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'reports',     jsonb_build_object('create',false,'read',true,'update',false,'delete',false,'manage',false),
      'settings',    jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'promotions',  jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'sales',       jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false),
      'repairs',     jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false)
    );
  END IF;

  -- Merge explicit permissions (user_permissions) on top of role matrix
  -- Assuming user_permissions table exists and has a 'permission' text column like 'resource.action'
  -- Need to handle potential errors if table doesn't exist, but typically in migration it should be ensured.
  -- We'll just run the loop.
  FOR perm_row IN
    SELECT permission
    FROM user_permissions
    WHERE user_id = p_user_id
      AND (is_active IS NULL OR is_active = true)
  LOOP
    parts := string_to_array(perm_row.permission, '.');
    res := parts[1];
    act := parts[2];
    
    IF res IS NULL OR act IS NULL OR res = '' OR act = '' THEN
      CONTINUE;
    END IF;

    -- Initialize resource block if missing (e.g. if explicit perm introduces new resource)
    IF NOT (perms ? res) THEN
      perms := perms || jsonb_build_object(res, jsonb_build_object('create',false,'read',false,'update',false,'delete',false,'manage',false));
    END IF;

    IF act = 'manage' THEN
      perms := jsonb_set(perms, ARRAY[res,'create'], 'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'read'],   'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'update'], 'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'delete'], 'true'::jsonb, true);
      perms := jsonb_set(perms, ARRAY[res,'manage'], 'true'::jsonb, true);
    ELSE
      perms := jsonb_set(perms, ARRAY[res,act], 'true'::jsonb, true);
    END IF;
  END LOOP;

  RETURN perms;
END;
$$;

COMMENT ON FUNCTION public.get_user_permissions(uuid) IS 'Retorna matriz resource->actions combinando rol de user_roles/profiles + permisos directos activos.';
