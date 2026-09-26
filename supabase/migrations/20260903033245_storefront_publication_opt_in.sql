-- Run before deploying the publication controls. Existing storefront access is preserved.
begin;

alter table public.organizations add column if not exists storefront_public boolean;
update public.organizations
set storefront_public = coalesce(marketplace_public, true)
where storefront_public is null;
alter table public.organizations alter column storefront_public set default false;
alter table public.organizations alter column storefront_public set not null;
alter table public.organizations alter column marketplace_public set default false;

-- Preserve the old implicit cart mode for existing organizations without a row.
insert into public.website_settings (organization_id, key, value)
select id, 'checkout', '{"commerceMode":"cart"}'::jsonb from public.organizations
on conflict (organization_id, key) do nothing;

-- New organizations start with WhatsApp, without overwriting explicit checkout settings.
create or replace function public.initialize_storefront_checkout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.website_settings (organization_id, key, value)
  values (new.id, 'checkout', '{"commerceMode":"whatsapp"}'::jsonb)
  on conflict (organization_id, key) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_storefront_checkout() from public, anon, authenticated;
drop trigger if exists initialize_storefront_checkout on public.organizations;
create trigger initialize_storefront_checkout after insert on public.organizations
for each row execute function public.initialize_storefront_checkout();

-- Completing or revisiting onboarding must never publish a store implicitly.
create or replace function public.complete_organization_onboarding(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_currency text,
  p_timezone text,
  p_logo_url text,
  p_modules jsonb,
  p_branch jsonb,
  p_company_info jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_branch_id uuid;
  completed_at timestamptz := now();
begin
  if not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ) and not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
      and profile.role = 'super_admin'
      and coalesce(profile.status, 'active') not in ('inactive', 'suspended')
  ) then
    raise exception 'ONBOARDING_FORBIDDEN';
  end if;

  update public.organizations
  set name = p_display_name,
      logo_url = nullif(p_logo_url, ''),
      updated_at = completed_at
  where id = p_organization_id;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.organization_settings (
    organization_id,
    display_name,
    currency,
    timezone,
    branding,
    modules,
    updated_at
  )
  values (
    p_organization_id,
    p_display_name,
    p_currency,
    p_timezone,
    '{}'::jsonb,
    coalesce(p_modules, '{}'::jsonb),
    completed_at
  )
  on conflict (organization_id) do update
  set display_name = excluded.display_name,
      currency = excluded.currency,
      timezone = excluded.timezone,
      modules = excluded.modules,
      updated_at = excluded.updated_at;

  select branch.id
  into target_branch_id
  from public.branches branch
  where branch.organization_id = p_organization_id
    and (branch.is_default = true or branch.slug = 'principal')
  order by branch.is_default desc, branch.created_at asc
  limit 1
  for update;

  if target_branch_id is null then
    insert into public.branches (
      organization_id,
      code,
      name,
      slug,
      address,
      city,
      phone,
      email,
      is_active,
      is_default,
      metadata,
      updated_at
    )
    values (
      p_organization_id,
      'principal',
      'Sucursal principal',
      'principal',
      p_branch->>'address',
      p_branch->>'city',
      nullif(p_branch->>'phone', ''),
      nullif(p_branch->>'email', ''),
      true,
      true,
      jsonb_build_object('onboarding_completed_at', completed_at),
      completed_at
    )
    returning id into target_branch_id;
  else
    update public.branches
    set address = p_branch->>'address',
        city = p_branch->>'city',
        phone = nullif(p_branch->>'phone', ''),
        email = nullif(p_branch->>'email', ''),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object('onboarding_completed_at', completed_at),
        updated_at = completed_at
    where id = target_branch_id;
  end if;

  insert into public.website_settings (
    organization_id,
    key,
    value,
    updated_by,
    updated_at
  )
  values (
    p_organization_id,
    'company_info',
    coalesce(p_company_info, '{}'::jsonb) || (
      select jsonb_build_object('marketplacePublic', marketplace_public, 'storefrontPublic', storefront_public)
      from public.organizations where id = p_organization_id
    ),
    p_user_id,
    completed_at
  )
  on conflict (organization_id, key) do update
  set value = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'branch_id', target_branch_id,
    'completed_at', completed_at
  );
end;
$$;

revoke all on function public.complete_organization_onboarding(
  uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb
) from public;

grant execute on function public.complete_organization_onboarding(
  uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb
) to service_role;



comment on column public.organizations.storefront_public is
'Explicit publication of tenant storefront pages and APIs, independent of marketplace discovery.';

-- Prevent legacy permissive SELECT policies from exposing an unpublished
-- website's settings through the Data API. Existing staff permissions remain.
drop policy if exists website_settings_publication_gate on public.website_settings;
create policy website_settings_publication_gate on public.website_settings
as restrictive for select to anon, authenticated
using (
  public.has_org_permission(organization_id, 'settings.read')
  or public.has_org_permission(organization_id, 'settings.manage')
  or exists (
    select 1 from public.organizations org
    where org.id = website_settings.organization_id and org.storefront_public = true
  )
);
commit;
