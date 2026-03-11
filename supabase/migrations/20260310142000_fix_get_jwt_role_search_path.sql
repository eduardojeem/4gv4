-- ============================================================================
-- Ensure get_jwt_role sets search_path to public (fix mutable search_path warning)
-- Fecha: 2026-03-10
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    'cliente'
  )::text;
$$;
