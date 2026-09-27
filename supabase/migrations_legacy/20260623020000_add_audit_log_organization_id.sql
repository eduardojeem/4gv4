-- Scope security audit events by organization so /admin/security can filter
-- before pagination and avoid mixing tenant activity.
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

WITH payload_organizations AS (
  SELECT
    id,
    COALESCE(
      NULLIF(new_values->>'organization_id', ''),
      NULLIF(details->>'organization_id', '')
    ) AS organization_id
  FROM public.audit_log
  WHERE organization_id IS NULL
)
UPDATE public.audit_log AS audit_log
SET organization_id = payload_organizations.organization_id::uuid
FROM payload_organizations
WHERE audit_log.id = payload_organizations.id
  AND payload_organizations.organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

WITH single_organization_members AS (
  SELECT
    user_id,
    (ARRAY_AGG(organization_id))[1] AS organization_id
  FROM public.organization_members
  WHERE status = 'active'
  GROUP BY user_id
  HAVING COUNT(DISTINCT organization_id) = 1
)
UPDATE public.audit_log AS audit_log
SET organization_id = single_organization_members.organization_id
FROM single_organization_members
WHERE audit_log.organization_id IS NULL
  AND audit_log.user_id = single_organization_members.user_id;

CREATE INDEX IF NOT EXISTS idx_audit_log_organization_created
  ON public.audit_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_organization_severity_created
  ON public.audit_log(organization_id, severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_audit_log_organization_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload_organization_id text;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  payload_organization_id := COALESCE(
    NULLIF(NEW.new_values->>'organization_id', ''),
    NULLIF(NEW.details->>'organization_id', '')
  );

  IF payload_organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.organization_id := payload_organization_id::uuid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_audit_log_organization_id ON public.audit_log;
CREATE TRIGGER set_audit_log_organization_id
BEFORE INSERT OR UPDATE OF new_values, details, organization_id
ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_log_organization_id();
