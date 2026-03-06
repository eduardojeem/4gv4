-- Post-check for 20260306_finalize_website_settings_rls_and_defaults.sql
-- Read-only verification queries

-- 1) Table + RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'website_settings';

-- 2) Required keys present
SELECT key
FROM public.website_settings
WHERE key IN (
  'company_info',
  'hero_content',
  'hero_stats',
  'services',
  'testimonials',
  'maintenance_mode'
)
ORDER BY key;

-- 3) Count sanity
SELECT COUNT(*) AS required_keys_count
FROM public.website_settings
WHERE key IN (
  'company_info',
  'hero_content',
  'hero_stats',
  'services',
  'testimonials',
  'maintenance_mode'
);

-- 4) Policies installed
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'website_settings'
ORDER BY policyname;

-- 5) Trigger installed
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'website_settings'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
