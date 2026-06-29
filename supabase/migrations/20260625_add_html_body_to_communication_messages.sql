-- =============================================================================
-- MIGRATION: 20260625_add_html_body_to_communication_messages
-- Agrega html_body para poder ver el contenido de cada mensaje en superadmin.
-- =============================================================================

ALTER TABLE public.communication_messages
  ADD COLUMN IF NOT EXISTS html_body TEXT;
