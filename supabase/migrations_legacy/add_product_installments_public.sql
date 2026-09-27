-- =====================================================
-- CUOTAS: separar "activar financiación" de "mostrar en la web pública"
-- =====================================================
-- installments_enabled: el producto tiene cuotas configuradas (los planes se conservan).
-- installments_public : si esas cuotas se muestran en la tienda pública.
-- Así, apagar la visibilidad pública NO borra los planes.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS installments_public BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN products.installments_public IS
  'Si las cuotas configuradas se muestran en la tienda pública. No afecta a que los planes queden guardados.';
