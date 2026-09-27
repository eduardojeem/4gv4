-- Replace role-check functions to use JWT claims instead of querying RLS-protected tables

CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')::text;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('admin','super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() = 'manager';
$$;

CREATE OR REPLACE FUNCTION public.is_cashier()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() = 'cashier';
$$;

CREATE OR REPLACE FUNCTION public.is_technician()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() = 'technician';
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT public.is_admin() OR public.is_manager() OR public.is_cashier() OR public.is_technician();
$$;

