-- system_settings is platform-level configuration. Tenant admins may read the
-- defaults, but only super admins may change the global row.

drop policy if exists "Admins can update system settings" on public.system_settings;
drop policy if exists "Admins can insert system settings" on public.system_settings;

create policy "Super admins can update system settings"
on public.system_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and ur.role = 'super_admin'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and ur.role = 'super_admin'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

create policy "Super admins can insert system settings"
on public.system_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and ur.role = 'super_admin'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);
