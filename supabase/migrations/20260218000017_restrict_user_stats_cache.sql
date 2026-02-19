-- Restrict access to materialized view user_stats_cache
-- By default, materialized views in Supabase are accessible via the Data API if not restricted.
-- We need to revoke select permissions from anon and authenticated roles, 
-- and ensure access is only possible through secure functions or specific roles if needed.

-- Revoke all permissions from anon and authenticated roles
REVOKE ALL ON public.user_stats_cache FROM anon;
REVOKE ALL ON public.user_stats_cache FROM authenticated;

-- Grant access only to service_role (implicit, but good to be explicit about intent)
-- or specific internal roles if necessary.
-- Since this cache is likely used by the get_user_stats() function which is SECURITY DEFINER,
-- direct access to the view is not needed by normal users.

-- If we need to allow access to specific authenticated users (e.g. admins), we should do it via RLS,
-- but Materialized Views don't support RLS directly in the same way tables do.
-- The best practice is to revoke direct access and expose data via functions.

-- Ensure the function refresh_user_stats_cache can still work (it is SECURITY DEFINER so it uses owner permissions).
