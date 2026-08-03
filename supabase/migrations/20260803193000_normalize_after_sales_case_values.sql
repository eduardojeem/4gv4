-- Make after_sales_cases compatible with both the legacy Spanish identifiers
-- already present in production and the canonical English identifiers used by
-- the application. The API normalizes both formats at its boundary.

BEGIN;

-- Known names from both the original and legacy production schemas. Drop them
-- explicitly before changing values; relying only on conkey is insufficient on
-- some PostgreSQL versions because CHECK constraints may expose a null conkey.
ALTER TABLE public.after_sales_cases
  DROP CONSTRAINT IF EXISTS after_sales_cases_source_type_check,
  DROP CONSTRAINT IF EXISTS after_sales_cases_request_type_check,
  DROP CONSTRAINT IF EXISTS after_sales_cases_status_check,
  DROP CONSTRAINT IF EXISTS after_sales_source_reference_chk,
  DROP CONSTRAINT IF EXISTS after_sales_cases_source_reference_chk;

-- Drop only CHECK constraints that involve the three discriminator columns.
-- This also removes the source/reference check temporarily; it is recreated
-- below after the data conversion.
DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT DISTINCT constraint_info.conname
    FROM pg_constraint constraint_info
    JOIN pg_class relation ON relation.oid = constraint_info.conrelid
    JOIN pg_namespace namespace_info ON namespace_info.oid = relation.relnamespace
    JOIN unnest(constraint_info.conkey) AS key_column(attnum) ON true
    JOIN pg_attribute attribute_info
      ON attribute_info.attrelid = relation.oid
     AND attribute_info.attnum = key_column.attnum
    WHERE namespace_info.nspname = 'public'
      AND relation.relname = 'after_sales_cases'
      AND constraint_info.contype = 'c'
      AND attribute_info.attname IN ('status', 'request_type', 'source_type')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.after_sales_cases DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.after_sales_cases
  ADD CONSTRAINT after_sales_cases_source_type_check
    CHECK (source_type IN ('repair', 'sale', 'reparacion', 'venta')),
  ADD CONSTRAINT after_sales_cases_request_type_check
    CHECK (request_type IN (
      'repair_warranty', 'product_warranty', 'exchange', 'return',
      'garantia_reparacion', 'garantia_producto', 'cambio', 'devolucion'
    )),
  ADD CONSTRAINT after_sales_cases_status_check
    CHECK (status IN (
      'open', 'approved', 'rejected', 'completed', 'cancelled',
      'abierto', 'aprobado', 'rechazado', 'completado', 'cancelado'
    )),
  ADD CONSTRAINT after_sales_source_reference_chk
    CHECK (
      (source_type IN ('repair', 'reparacion') AND repair_id IS NOT NULL)
      OR
      (source_type IN ('sale', 'venta') AND sale_id IS NOT NULL)
    );

COMMIT;
