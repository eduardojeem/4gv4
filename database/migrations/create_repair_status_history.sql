-- ============================================================================
-- Historial de cambios de estado de reparaciones
-- Registra quién cambió el estado, cuándo, de qué estado a cuál, y con qué nota
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.repair_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Si la tabla ya existía sin organization_id, agregarla
ALTER TABLE public.repair_status_history
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS idx_repair_status_history_repair
  ON public.repair_status_history(repair_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_repair_status_history_user
  ON public.repair_status_history(changed_by, created_at DESC);

-- RLS
ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;

-- Quitar políticas viejas si existen
DROP POLICY IF EXISTS "Org staff can read status history" ON public.repair_status_history;
DROP POLICY IF EXISTS "Org staff can insert status history" ON public.repair_status_history;

-- Staff de la organización puede leer
CREATE POLICY "Org staff can read status history"
  ON public.repair_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = repair_status_history.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Staff de la organización puede insertar
CREATE POLICY "Org staff can insert status history"
  ON public.repair_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = repair_status_history.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );
