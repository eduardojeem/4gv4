-- Permite emails del sistema (superadmin, pruebas) sin organización asociada.
ALTER TABLE public.communication_messages
  ALTER COLUMN organization_id DROP NOT NULL;
