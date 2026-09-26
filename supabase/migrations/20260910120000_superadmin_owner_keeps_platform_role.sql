-- Asignar un propietario desde el alta de superadmin no toca su rol en la plataforma.
--
-- `assign_superadmin_organization_owner` hacia, para cualquier usuario:
--
--   insert into user_roles ... on conflict (user_id) do update set role = 'admin'
--   insert into profiles   ... on conflict (id)      do update set role = 'admin'
--
-- `user_roles` tiene UNIQUE(user_id): un solo rol global por persona, y
-- `getSuperAdminUser` exige que ese rol sea 'super_admin'. Crear una
-- organizacion con el correo de un superadmin como propietario le quitaba el
-- acceso al panel, sin pasar por `set_super_admin_role` y por lo tanto
-- salteando el control LAST_SUPER_ADMIN: el unico superadmin podia dejar la
-- plataforma sin ninguno con solo crear una organizacion de prueba.
--
-- A cualquier otra persona con cuenta le pisaba el rol global y reactivaba un
-- perfil suspendido.
--
-- Ahora:
--   * el rol global solo se asigna a quien no tiene ninguno;
--   * un perfil existente conserva su rol y su estado;
--   * un perfil suspendido o inactivo no se asigna: se rechaza con
--     OWNER_SUSPENDED, porque quedaria como propietario de algo a lo que no
--     puede entrar.

create or replace function public.assign_superadmin_organization_owner(
  p_organization_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_status text;
begin
  if not exists (select 1 from public.organizations where id = p_organization_id for update) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  select status into v_profile_status
    from public.profiles
   where id = p_user_id;

  if v_profile_status in ('inactive', 'suspended') then
    raise exception 'OWNER_SUSPENDED';
  end if;

  insert into public.profiles (id, email, full_name, role, status)
  values (p_user_id, lower(trim(p_email)), nullif(trim(p_full_name), ''), 'admin', 'active')
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.user_roles (user_id, role, is_active, updated_at)
  values (p_user_id, 'admin', true, now())
  on conflict (user_id) do nothing;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_organization_id, p_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do update
    set role = 'owner',
        status = 'active',
        updated_at = now();

  update public.organizations
     set owner_id = p_user_id,
         updated_at = now()
   where id = p_organization_id;
end;
$$;

revoke all on function public.assign_superadmin_organization_owner(uuid, uuid, text, text) from public;
grant execute on function public.assign_superadmin_organization_owner(uuid, uuid, text, text) to service_role;
