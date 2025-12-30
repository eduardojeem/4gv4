BEGIN;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
UPDATE public.repairs r
SET received_at = COALESCE(
  (SELECT MIN(h.created_at) FROM public.repair_status_history h WHERE h.repair_id = r.id AND h.new_status = 'recibido'),
  r.created_at
)
WHERE received_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_received_at ON public.repairs(received_at);
COMMIT;
