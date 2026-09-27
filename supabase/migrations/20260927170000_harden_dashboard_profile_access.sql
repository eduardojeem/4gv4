begin;

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;

grant select (
  username, full_name, job_title, bio, location, avatar_url,
  website, social_links, updated_at
) on public.profiles to anon;

grant select (
  id, full_name, role, avatar_url, phone, email, created_at, updated_at,
  department, status, bio, website, job_title, timezone, social_links,
  preferences, location, username, display_name, title, is_public
) on public.profiles to authenticated;

grant insert (
  id, full_name, avatar_url, phone, email, created_at, updated_at,
  department, bio, website, job_title, timezone, social_links,
  preferences, location
) on public.profiles to authenticated;

grant update (
  full_name, avatar_url, phone, department, bio, website, job_title,
  timezone, social_links, preferences, location, updated_at
) on public.profiles to authenticated;

grant all on table public.profiles to service_role;

drop policy if exists "profiles_select_consolidated" on public.profiles;
drop policy if exists "profiles_update_consolidated" on public.profiles;
drop policy if exists "profiles_insert_consolidated" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "profiles_select_scoped" on public.profiles;
drop policy if exists "profiles_update_scoped" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_delete_scoped" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;

create policy "profiles_select_public" on public.profiles
for select to anon using (is_public = true);

create policy "profiles_select_scoped" on public.profiles
for select to authenticated
using (
  profiles.id = (select auth.uid())
  or public.get_jwt_role() = 'super_admin'
  or (
    profiles.role <> 'super_admin'
    and exists (
      select 1
      from public.organization_members caller_membership
      join public.organization_members target_membership
        on caller_membership.organization_id = target_membership.organization_id
      where caller_membership.user_id = (select auth.uid())
        and caller_membership.status = 'active'
        and caller_membership.role <> 'customer'
        and target_membership.user_id = profiles.id
        and target_membership.status = 'active'
    )
  )
);

create policy "profiles_update_scoped" on public.profiles
for update to authenticated
using (
  profiles.id = (select auth.uid())
  or public.get_jwt_role() = 'super_admin'
  or (
    profiles.role <> 'super_admin'
    and exists (
      select 1
      from public.organization_members caller_membership
      join public.organization_members target_membership
        on caller_membership.organization_id = target_membership.organization_id
      where caller_membership.user_id = (select auth.uid())
        and caller_membership.status = 'active'
        and caller_membership.role in ('owner', 'admin')
        and target_membership.user_id = profiles.id
        and target_membership.status = 'active'
    )
  )
)
with check (
  profiles.id = (select auth.uid())
  or public.get_jwt_role() = 'super_admin'
  or (
    profiles.role <> 'super_admin'
    and exists (
      select 1
      from public.organization_members caller_membership
      join public.organization_members target_membership
        on caller_membership.organization_id = target_membership.organization_id
      where caller_membership.user_id = (select auth.uid())
        and caller_membership.status = 'active'
        and caller_membership.role in ('owner', 'admin')
        and target_membership.user_id = profiles.id
        and target_membership.status = 'active'
    )
  )
);

create policy "profiles_insert_self" on public.profiles
for insert to authenticated
with check (profiles.id = (select auth.uid()));

create policy "profiles_delete_scoped" on public.profiles
for delete to authenticated
using (
  public.get_jwt_role() = 'super_admin'
  or (
    profiles.role <> 'super_admin'
    and exists (
      select 1
      from public.organization_members caller_membership
      join public.organization_members target_membership
        on caller_membership.organization_id = target_membership.organization_id
      where caller_membership.user_id = (select auth.uid())
        and caller_membership.status = 'active'
        and caller_membership.role in ('owner', 'admin')
        and target_membership.user_id = profiles.id
        and target_membership.status = 'active'
    )
  )
);

commit;
