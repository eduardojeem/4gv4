-- Tabla de reseñas/calificaciones públicas de organizaciones
CREATE TABLE IF NOT EXISTS public.organization_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL CHECK (char_length(reviewer_name) BETWEEN 2 AND 100),
  reviewer_email TEXT CHECK (reviewer_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHECK (char_length(comment) <= 500),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_org_reviews_org_id 
  ON public.organization_reviews(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_reviews_approved_visible 
  ON public.organization_reviews(organization_id, is_approved, is_visible)
  WHERE is_approved = true AND is_visible = true;

-- Columnas de rating promedio en organizations (denormalizadas para rendimiento)
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS review_rating_avg NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Habilitar RLS
ALTER TABLE public.organization_reviews ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer reseñas aprobadas y visibles
CREATE POLICY "Public can read approved reviews"
  ON public.organization_reviews
  FOR SELECT
  USING (is_approved = true AND is_visible = true);

-- Cualquiera puede insertar una reseña (se modera antes de mostrarse)
CREATE POLICY "Anyone can submit a review"
  ON public.organization_reviews
  FOR INSERT
  WITH CHECK (true);

-- Admins/owners de la organización pueden gestionar reseñas
CREATE POLICY "Org admins can manage reviews"
  ON public.organization_reviews
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_reviews.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Función para recalcular promedios al insertar/actualizar/eliminar reseñas
CREATE OR REPLACE FUNCTION public.refresh_organization_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_org_id UUID;
BEGIN
  target_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  
  UPDATE public.organizations
  SET 
    review_rating_avg = COALESCE(
      (SELECT AVG(rating)::NUMERIC(3,2) 
       FROM public.organization_reviews 
       WHERE organization_id = target_org_id 
       AND is_approved = true 
       AND is_visible = true),
      0
    ),
    review_count = (
      SELECT COUNT(*) 
      FROM public.organization_reviews 
      WHERE organization_id = target_org_id 
      AND is_approved = true 
      AND is_visible = true
    ),
    updated_at = now()
  WHERE id = target_org_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para mantener stats actualizados
CREATE TRIGGER trg_refresh_review_stats_insert
  AFTER INSERT ON public.organization_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_organization_review_stats();

CREATE TRIGGER trg_refresh_review_stats_update
  AFTER UPDATE OF is_approved, is_visible, rating ON public.organization_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_organization_review_stats();

CREATE TRIGGER trg_refresh_review_stats_delete
  AFTER DELETE ON public.organization_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_organization_review_stats();
