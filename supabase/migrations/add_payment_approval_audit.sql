-- =====================================================
-- Auditoría de confirmación doble en pagos a técnicos
-- =====================================================
-- Separa la APROBACIÓN del admin (approved_by/at) de la CONFIRMACIÓN de
-- recibo del técnico (confirmed_by/at ya existente).
--   - approved_by/at : admin que dejó el pago en 'pagado' (al crear o al confirmar).
--   - confirmed_by/at: quién acusó recibo. Si confirmed_by = technician_id, lo
--                      confirmó el propio técnico; si no, un admin en su nombre.

alter table technician_payments
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz;

comment on column technician_payments.approved_by is 'Admin que aprobó/registró el pago como pagado.';
comment on column technician_payments.approved_at is 'Fecha de aprobación del pago por el admin.';
