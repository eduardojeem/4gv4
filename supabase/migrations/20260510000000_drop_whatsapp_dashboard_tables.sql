-- Remove deprecated /dashboard/whatsapp storage

DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_settings CASCADE;
