-- =====================================================
-- CUOTAS: planes múltiples por producto (recargo distinto por opción)
-- =====================================================
-- Reemplaza el modelo simple (installments_max_count + installments_interest_rate)
-- por una lista de planes: [{ "count": 3, "rate": 0 }, { "count": 12, "rate": 20 }]
--   count = cantidad de cuotas (1-60)
--   rate  = % de recargo total sobre el precio para esa opción
-- Es solo informativo: la web pública calcula y muestra el precio por cuota.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS installments_plans JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.installments_plans IS
  'Planes de cuotas ofrecidos: [{"count":int 1-60,"rate":numeric % recargo}]. Informativo para la web pública.';

-- Eliminar las columnas del modelo anterior (ya no se usan)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_installments_max_count_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_installments_interest_rate_check;
ALTER TABLE products DROP COLUMN IF EXISTS installments_max_count;
ALTER TABLE products DROP COLUMN IF EXISTS installments_interest_rate;
