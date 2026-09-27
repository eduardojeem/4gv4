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
      marketplace_public = true,
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
    coalesce(p_company_info, '{}'::jsonb),
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
