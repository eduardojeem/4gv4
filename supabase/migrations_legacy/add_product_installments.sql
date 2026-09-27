-- =====================================================
-- CUOTAS / FINANCIACIÓN POR PRODUCTO (informativo en la web pública)
-- =====================================================
-- Permite marcar un producto como "disponible en cuotas" y definir
-- hasta cuántas cuotas se ofrecen y qué % de recargo se aplica.
-- El cálculo de la cuota se hace en la web pública (solo informativo).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS installments_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installments_max_count INTEGER,
  ADD COLUMN IF NOT EXISTS installments_interest_rate NUMERIC(6,2) NOT NULL DEFAULT 0;

-- Validaciones a nivel de base
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_installments_max_count_check;
ALTER TABLE products
  ADD CONSTRAINT products_installments_max_count_check
  CHECK (installments_max_count IS NULL OR (installments_max_count >= 1 AND installments_max_count <= 60));

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_installments_interest_rate_check;
ALTER TABLE products
  ADD CONSTRAINT products_installments_interest_rate_check
  CHECK (installments_interest_rate >= 0 AND installments_interest_rate <= 1000);

COMMENT ON COLUMN products.installments_enabled IS 'Si el producto se ofrece en cuotas (mostrado en la web pública)';
COMMENT ON COLUMN products.installments_max_count IS 'Cantidad máxima de cuotas ofrecidas (1-60)';
COMMENT ON COLUMN products.installments_interest_rate IS 'Porcentaje de recargo total sobre el precio al financiar en cuotas';
