ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS public_mode text NOT NULL DEFAULT 'disabled';

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_public_mode_check;

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_public_mode_check
  CHECK (public_mode IN ('disabled', 'coupon', 'automatic'));

CREATE INDEX IF NOT EXISTS idx_promotions_org_public_mode
ON public.promotions(organization_id, public_mode, is_active);

COMMENT ON COLUMN public.promotions.public_mode IS
'disabled: solo uso interno/POS; coupon: canjeable en tienda publica; automatic: genera oferta publica para productos elegibles';
