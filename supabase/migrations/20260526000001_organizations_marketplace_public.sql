-- Agrega flag para controlar si una organización aparece en el marketplace público.
-- Por defecto false: las orgs existentes no aparecen hasta que el owner lo habilite.
alter table public.organizations
  add column if not exists marketplace_public boolean not null default false;

comment on column public.organizations.marketplace_public is
  'Cuando true, la organización aparece en /marketplace como empresa pública.';
