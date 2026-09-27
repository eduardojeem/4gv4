-- =====================================================
-- Sueldo base: fecha "vigente desde" (para prorratear el primer mes)
-- =====================================================
-- Define desde qué día corre el sueldo base del técnico. El cálculo de la
-- ganancia prorratea el sueldo del mes según esta fecha:
--   - vacío / anterior al mes  -> mes completo
--   - a mitad de mes           -> proporcional a los días trabajados
--   - posterior al mes         -> 0

alter table technician_compensation
  add column if not exists salary_effective_from date;

comment on column technician_compensation.salary_effective_from is
  'Fecha desde la que corre el sueldo base (para prorratear el primer mes). NULL = sin prorrateo.';
