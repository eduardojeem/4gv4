-- Remove duplicate trigger on website_settings
-- Keep only tr_website_settings_updated_at

BEGIN;

DROP TRIGGER IF EXISTS website_settings_updated_at ON public.website_settings;

COMMIT;
