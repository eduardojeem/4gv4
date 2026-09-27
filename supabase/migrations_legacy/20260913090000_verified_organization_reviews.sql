BEGIN;

ALTER TABLE public.organization_reviews
  ADD COLUMN IF NOT EXISTS moderation_status text,
  ADD COLUMN IF NOT EXISTS verification_type text,
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repair_id uuid REFERENCES public.repairs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.organization_reviews
SET
  moderation_status = CASE
    WHEN is_approved AND is_visible THEN 'published'
    WHEN is_approved AND NOT is_visible THEN 'hidden'
    ELSE 'pending'
  END,
  verification_type = 'open',
  published_at = CASE WHEN is_approved AND is_visible THEN COALESCE(published_at, created_at) ELSE published_at END
WHERE moderation_status IS NULL OR verification_type IS NULL;

ALTER TABLE public.organization_reviews
  ALTER COLUMN moderation_status SET DEFAULT 'pending',
  ALTER COLUMN moderation_status SET NOT NULL,
  ALTER COLUMN verification_type SET DEFAULT 'open',
  ALTER COLUMN verification_type SET NOT NULL;

ALTER TABLE public.organization_reviews
  DROP CONSTRAINT IF EXISTS organization_reviews_moderation_status_check,
  ADD CONSTRAINT organization_reviews_moderation_status_check
    CHECK (moderation_status IN ('pending', 'published', 'rejected', 'hidden', 'reported')),
  DROP CONSTRAINT IF EXISTS organization_reviews_verification_type_check,
  ADD CONSTRAINT organization_reviews_verification_type_check
    CHECK (verification_type IN ('open', 'purchase', 'repair')),
  DROP CONSTRAINT IF EXISTS organization_reviews_source_check,
  ADD CONSTRAINT organization_reviews_source_check CHECK (
    (verification_type = 'open' AND sale_id IS NULL AND repair_id IS NULL)
    OR (verification_type = 'purchase' AND sale_id IS NOT NULL AND repair_id IS NULL)
    OR (verification_type = 'repair' AND repair_id IS NOT NULL AND sale_id IS NULL)
  ),
  DROP CONSTRAINT IF EXISTS organization_reviews_response_length_check,
  ADD CONSTRAINT organization_reviews_response_length_check
    CHECK (business_response IS NULL OR char_length(business_response) BETWEEN 2 AND 1000),
  DROP CONSTRAINT IF EXISTS organization_reviews_moderation_reason_check,
  ADD CONSTRAINT organization_reviews_moderation_reason_check CHECK (
    moderation_status NOT IN ('rejected', 'hidden', 'reported')
    OR char_length(trim(COALESCE(moderation_reason, ''))) BETWEEN 3 AND 500
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_reviews_sale_verified
  ON public.organization_reviews(organization_id, sale_id)
  WHERE sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_reviews_repair_verified
  ON public.organization_reviews(organization_id, repair_id)
  WHERE repair_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_reviews_public_status
  ON public.organization_reviews(organization_id, moderation_status, verification_type, created_at DESC);

DROP POLICY IF EXISTS "Public can read approved reviews" ON public.organization_reviews;
DROP POLICY IF EXISTS "Org admins can manage reviews" ON public.organization_reviews;
DROP POLICY IF EXISTS "Public can read published reviews" ON public.organization_reviews;
CREATE POLICY "Public can read published reviews"
  ON public.organization_reviews FOR SELECT TO anon, authenticated
  USING (moderation_status = 'published');

REVOKE ALL ON public.organization_reviews FROM anon, authenticated;
GRANT SELECT (
  id,
  organization_id,
  reviewer_name,
  rating,
  comment,
  moderation_status,
  verification_type,
  business_response,
  responded_at,
  created_at
) ON public.organization_reviews TO anon, authenticated;
GRANT ALL ON public.organization_reviews TO service_role;

CREATE TABLE IF NOT EXISTS public.organization_review_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  verification_type text NOT NULL CHECK (verification_type IN ('purchase', 'repair')),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  repair_id uuid REFERENCES public.repairs(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_review_invites_source_check CHECK (
    (verification_type = 'purchase' AND sale_id IS NOT NULL AND repair_id IS NULL)
    OR (verification_type = 'repair' AND repair_id IS NOT NULL AND sale_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_invites_sale_active
  ON public.organization_review_invites(organization_id, sale_id)
  WHERE sale_id IS NOT NULL AND used_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_invites_repair_active
  ON public.organization_review_invites(organization_id, repair_id)
  WHERE repair_id IS NOT NULL AND used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_invites_lookup
  ON public.organization_review_invites(token_hash, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.organization_review_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can read review invites" ON public.organization_review_invites;
CREATE POLICY "Org admins can read review invites"
  ON public.organization_review_invites FOR SELECT TO authenticated
  USING (public.get_org_role(organization_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Org admins can manage review invites" ON public.organization_review_invites;
CREATE POLICY "Org admins can manage review invites"
  ON public.organization_review_invites FOR ALL TO authenticated
  USING (public.get_org_role(organization_id) IN ('owner', 'admin'))
  WITH CHECK (public.get_org_role(organization_id) IN ('owner', 'admin'));

REVOKE ALL ON public.organization_review_invites FROM anon, authenticated;
GRANT ALL ON public.organization_review_invites TO service_role;

CREATE OR REPLACE FUNCTION public.sync_organization_review_legacy_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.is_approved := NEW.moderation_status IN ('published', 'hidden');
  NEW.is_visible := NEW.moderation_status = 'published';
  IF NEW.moderation_status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_organization_review_legacy_flags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_organization_review_legacy_flags ON public.organization_reviews;
CREATE TRIGGER trg_sync_organization_review_legacy_flags
  BEFORE INSERT OR UPDATE OF moderation_status ON public.organization_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_organization_review_legacy_flags();

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS review_verified_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_verified_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_organization_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_org_id uuid;
BEGIN
  target_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  UPDATE public.organizations
  SET
    review_rating_avg = COALESCE((
      SELECT avg(rating)::numeric(3,2)
      FROM public.organization_reviews
      WHERE organization_id = target_org_id AND moderation_status = 'published'
    ), 0),
    review_count = (
      SELECT count(*) FROM public.organization_reviews
      WHERE organization_id = target_org_id AND moderation_status = 'published'
    ),
    review_verified_avg = COALESCE((
      SELECT avg(rating)::numeric(3,2)
      FROM public.organization_reviews
      WHERE organization_id = target_org_id
        AND moderation_status = 'published'
        AND verification_type IN ('purchase', 'repair')
    ), 0),
    review_verified_count = (
      SELECT count(*) FROM public.organization_reviews
      WHERE organization_id = target_org_id
        AND moderation_status = 'published'
        AND verification_type IN ('purchase', 'repair')
    ),
    updated_at = now()
  WHERE id = target_org_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_organization_review_stats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_refresh_review_stats_update ON public.organization_reviews;
CREATE TRIGGER trg_refresh_review_stats_update
  AFTER UPDATE OF moderation_status, rating, verification_type, business_response
  ON public.organization_reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_organization_review_stats();

UPDATE public.organizations AS organization
SET
  review_rating_avg = COALESCE(stats.average, 0),
  review_count = COALESCE(stats.total, 0),
  review_verified_avg = COALESCE(stats.verified_average, 0),
  review_verified_count = COALESCE(stats.verified_total, 0)
FROM (
  SELECT
    organization_id,
    avg(rating) FILTER (WHERE moderation_status = 'published')::numeric(3,2) AS average,
    count(*) FILTER (WHERE moderation_status = 'published') AS total,
    avg(rating) FILTER (
      WHERE moderation_status = 'published' AND verification_type IN ('purchase', 'repair')
    )::numeric(3,2) AS verified_average,
    count(*) FILTER (
      WHERE moderation_status = 'published' AND verification_type IN ('purchase', 'repair')
    ) AS verified_total
  FROM public.organization_reviews
  GROUP BY organization_id
) AS stats
WHERE organization.id = stats.organization_id;

CREATE OR REPLACE FUNCTION public.submit_verified_organization_review(
  p_organization_id uuid,
  p_token_hash text,
  p_reviewer_name text,
  p_reviewer_email text,
  p_rating integer,
  p_comment text
)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  invite public.organization_review_invites%ROWTYPE;
BEGIN
  SELECT * INTO invite
  FROM public.organization_review_invites
  WHERE organization_id = p_organization_id
    AND token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_review_invite';
  END IF;

  RETURN QUERY
  INSERT INTO public.organization_reviews (
    organization_id,
    reviewer_name,
    reviewer_email,
    rating,
    comment,
    moderation_status,
    verification_type,
    sale_id,
    repair_id,
    customer_id
  ) VALUES (
    p_organization_id,
    p_reviewer_name,
    p_reviewer_email,
    p_rating,
    p_comment,
    'pending',
    invite.verification_type,
    invite.sale_id,
    invite.repair_id,
    invite.customer_id
  )
  RETURNING organization_reviews.id, organization_reviews.created_at;

  UPDATE public.organization_review_invites
  SET used_at = now()
  WHERE organization_review_invites.id = invite.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_verified_organization_review(uuid, text, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_verified_organization_review(uuid, text, text, text, integer, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_organization_review_public_stats(p_organization_id uuid)
RETURNS TABLE(
  average numeric,
  count bigint,
  verified_average numeric,
  verified_count bigint,
  responded_count bigint,
  satisfaction_rate integer,
  breakdown jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    COALESCE(avg(rating), 0)::numeric(3,2),
    count(*),
    COALESCE(avg(rating) FILTER (WHERE verification_type IN ('purchase', 'repair')), 0)::numeric(3,2),
    count(*) FILTER (WHERE verification_type IN ('purchase', 'repair')),
    count(*) FILTER (WHERE business_response IS NOT NULL),
    CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE rating >= 4) / count(*))::integer
    END,
    jsonb_build_object(
      '1', count(*) FILTER (WHERE rating = 1),
      '2', count(*) FILTER (WHERE rating = 2),
      '3', count(*) FILTER (WHERE rating = 3),
      '4', count(*) FILTER (WHERE rating = 4),
      '5', count(*) FILTER (WHERE rating = 5)
    )
  FROM public.organization_reviews
  WHERE organization_id = p_organization_id AND moderation_status = 'published';
$$;

REVOKE EXECUTE ON FUNCTION public.get_organization_review_public_stats(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_review_public_stats(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_organization_review_admin_stats(p_organization_id uuid)
RETURNS TABLE(
  total bigint,
  pending bigint,
  published bigint,
  rejected bigint,
  hidden bigint,
  reported bigint,
  average numeric,
  verified_average numeric,
  verified_count bigint,
  responded_count bigint,
  satisfaction_rate integer,
  breakdown jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE moderation_status = 'pending'),
    count(*) FILTER (WHERE moderation_status = 'published'),
    count(*) FILTER (WHERE moderation_status = 'rejected'),
    count(*) FILTER (WHERE moderation_status = 'hidden'),
    count(*) FILTER (WHERE moderation_status = 'reported'),
    COALESCE(avg(rating) FILTER (WHERE moderation_status = 'published'), 0)::numeric(3,2),
    COALESCE(avg(rating) FILTER (
      WHERE moderation_status = 'published' AND verification_type IN ('purchase', 'repair')
    ), 0)::numeric(3,2),
    count(*) FILTER (
      WHERE moderation_status = 'published' AND verification_type IN ('purchase', 'repair')
    ),
    count(*) FILTER (WHERE moderation_status = 'published' AND business_response IS NOT NULL),
    CASE WHEN count(*) FILTER (WHERE moderation_status = 'published') = 0 THEN 0
      ELSE round(
        100.0 * count(*) FILTER (WHERE moderation_status = 'published' AND rating >= 4)
        / count(*) FILTER (WHERE moderation_status = 'published')
      )::integer
    END,
    jsonb_build_object(
      '1', count(*) FILTER (WHERE moderation_status = 'published' AND rating = 1),
      '2', count(*) FILTER (WHERE moderation_status = 'published' AND rating = 2),
      '3', count(*) FILTER (WHERE moderation_status = 'published' AND rating = 3),
      '4', count(*) FILTER (WHERE moderation_status = 'published' AND rating = 4),
      '5', count(*) FILTER (WHERE moderation_status = 'published' AND rating = 5)
    )
  FROM public.organization_reviews
  WHERE organization_id = p_organization_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_organization_review_admin_stats(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_review_admin_stats(uuid)
  TO service_role;

COMMIT;
