-- Stores only guide preferences. Does not complete tasks or mutate operations.
create or replace function public.server_save_business_start_guide_preferences(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_preferences jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and m.role in ('owner', 'admin')
      and coalesce(p.status, 'active') not in ('inactive', 'suspended')
  ) then
    raise exception 'BUSINESS_START_GUIDE_FORBIDDEN';
  end if;
  if pg_catalog.jsonb_typeof(p_preferences) is distinct from 'object'
    or p_preferences->'version' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_preferences->'postponed') is distinct from 'boolean'
    or not (p_preferences ? 'teamMode')
    or (p_preferences->'teamMode' <> 'null'::jsonb and coalesce(p_preferences->>'teamMode', '') not in ('solo', 'team'))
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_preferences) k where k not in ('version', 'teamMode', 'postponed'))
  then
    raise exception 'BUSINESS_START_GUIDE_INVALID';
  end if;
  update public.organization_settings
  set modules = pg_catalog.jsonb_set(coalesce(modules, '{}'::jsonb), '{business_start_guide}', p_preferences, true)
  where organization_id = p_organization_id;
  if not found then raise exception 'BUSINESS_START_GUIDE_SETTINGS_REQUIRED'; end if;
end;
$$;
revoke all on function public.server_save_business_start_guide_preferences(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.server_save_business_start_guide_preferences(uuid, uuid, jsonb) to service_role;
