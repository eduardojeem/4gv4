alter table public.organization_settings
  add column if not exists repair_receipt_settings jsonb;

comment on column public.organization_settings.repair_receipt_settings is
  'Configuracion centralizada del comprobante de reparaciones para la organizacion.';

alter table public.organization_settings
  drop constraint if exists organization_settings_repair_receipt_settings_object;

alter table public.organization_settings
  add constraint organization_settings_repair_receipt_settings_object
  check (
    repair_receipt_settings is null
    or jsonb_typeof(repair_receipt_settings) = 'object'
  );
