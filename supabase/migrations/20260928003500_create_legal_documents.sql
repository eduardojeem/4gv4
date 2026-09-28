-- Versioned legal documents managed exclusively by SuperAdmin server actions.
-- Public pages read the published version through the service-role client; no
-- draft or historical version is exposed through PostgREST.

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('privacy', 'terms')),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 50 AND 60000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  change_summary text CHECK (change_summary IS NULL OR char_length(change_summary) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_draft_per_type
  ON public.legal_documents (document_type)
  WHERE status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_published_per_type
  ON public.legal_documents (document_type)
  WHERE status = 'published';

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.legal_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_documents TO service_role;

CREATE OR REPLACE FUNCTION public.publish_legal_document(
  p_document_id uuid,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_type text;
BEGIN
  SELECT document_type
    INTO v_type
  FROM public.legal_documents
  WHERE id = p_document_id
    AND status = 'draft'
  FOR UPDATE;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Legal document is not an existing draft'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.legal_documents
  SET status = 'archived',
      updated_at = now(),
      updated_by = p_actor_id
  WHERE document_type = v_type
    AND status = 'published';

  UPDATE public.legal_documents
  SET status = 'published',
      published_at = now(),
      published_by = p_actor_id,
      updated_at = now(),
      updated_by = p_actor_id
  WHERE id = p_document_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_legal_document(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_legal_document(uuid, uuid) TO service_role;

COMMENT ON TABLE public.legal_documents IS
  'Versioned platform privacy and terms documents. Drafts and history are server-only.';

-- Safe starter drafts. Placeholders intentionally prevent accidental
-- publication until the organization data and counsel-approved wording exist.
INSERT INTO public.legal_documents (document_type, version, title, content, status, change_summary)
VALUES
  (
    'privacy',
    1,
    'Política de privacidad',
    E'# Política de privacidad\n\nResponsable: [RAZÓN SOCIAL], RUC [RUC], domicilio [DOMICILIO].\n\n[COMPLETAR finalidades, bases, destinatarios, conservación, seguridad y derechos de las personas.]\n\nContacto: [EMAIL].',
    'draft',
    'Borrador inicial pendiente de revisión legal'
  ),
  (
    'terms',
    1,
    'Términos y condiciones',
    E'# Términos y condiciones\n\nPrestador: [RAZÓN SOCIAL], RUC [RUC], domicilio [DOMICILIO].\n\n[COMPLETAR alcance del SaaS y marketplace, cuentas, pagos, responsabilidades, suspensión y terminación.]\n\nContacto: [EMAIL].',
    'draft',
    'Borrador inicial pendiente de revisión legal'
  )
ON CONFLICT (document_type, version) DO NOTHING;
