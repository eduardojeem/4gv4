-- Canonical business profile for tenant-specific product experience.
-- enabled_modules intentionally remains nullable: NULL preserves every module
-- currently granted by the subscription while existing organizations migrate.

alter table public.organizations
  add column if not exists business_vertical text,
  add column if not exists operating_model text,
  add column if not exists enabled_modules text[];

update public.organizations organization
set
  business_vertical = case
    when lower(coalesce(settings.modules->'company_info'->>'businessType', '')) = 'repair'
      then 'electronics'
    else 'general'
  end,
  operating_model = case
    when lower(coalesce(settings.modules->'company_info'->>'businessType', '')) = 'repair'
      then 'repair'
    when lower(coalesce(settings.modules->'company_info'->>'businessType', '')) = 'wholesale'
      then 'wholesale'
    when lower(coalesce(settings.modules->'company_info'->>'businessType', '')) = 'service'
      then 'service'
    when lower(coalesce(settings.modules->'company_info'->>'businessType', '')) = 'mixed'
      then 'mixed'
    else 'retail'
  end
from public.organization_settings settings
where settings.organization_id = organization.id
  and (organization.business_vertical is null or organization.operating_model is null);

update public.organizations
set
  business_vertical = coalesce(business_vertical, 'general'),
  operating_model = coalesce(operating_model, 'retail')
where business_vertical is null or operating_model is null;

alter table public.organizations
  alter column business_vertical set default 'general',
  alter column business_vertical set not null,
  alter column operating_model set default 'retail',
  alter column operating_model set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_business_vertical_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_business_vertical_check
      check (business_vertical = any (array[
        'general', 'clothing', 'cosmetics', 'electronics', 'food', 'hardware', 'other'
      ]::text[]));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_operating_model_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_operating_model_check
      check (operating_model = any (array[
        'retail', 'wholesale', 'service', 'repair', 'mixed'
      ]::text[]));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_enabled_modules_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_enabled_modules_check
      check (
        enabled_modules is null
        or enabled_modules <@ array[
          'inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'ecommerce',
          'repairs', 'services', 'credits', 'delivery', 'analytics', 'promotions', 'security'
        ]::text[]
      );
  end if;
end $$;

comment on column public.organizations.business_vertical is
  'What the organization sells; independent from subscription and enabled modules.';
comment on column public.organizations.operating_model is
  'How the organization operates: retail, wholesale, service, repair, or mixed.';
comment on column public.organizations.enabled_modules is
  'Tenant-selected modules. NULL preserves all entitled modules for backwards compatibility.';
