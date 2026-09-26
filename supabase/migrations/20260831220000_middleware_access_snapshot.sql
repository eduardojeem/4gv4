-- Resuelve en UNA consulta todo lo que el middleware necesita para autorizar.
--
-- Antes cada request protegido encadenaba tres viajes a la base, en serie y
-- despues del getUser():
--   1. user_roles          (rol de plataforma + si esta activo)
--   2. profiles            (rol heredado + estado de la cuenta)
--   3. organization_members (solo si el rol daba 'cliente', que es el caso de
--                            casi todo el personal de una tienda)
--
-- Eran tres esperas encadenadas antes de renderizar nada, y ademas triplicaban
-- la carga de la base por cada vista de pagina. Esta funcion devuelve lo mismo
-- de una sola vez, leyendo siempre en vivo: no cachea nada, asi que revocar un
-- acceso sigue teniendo efecto inmediato.

begin;

create or replace function public.resolve_middleware_access(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  -- El usuario SIEMPRE sale del token, nunca de un parametro: recibirlo por
  -- argumento permitiria a cualquier autenticado pedir el acceso de otro.
  uid uuid := auth.uid();
  platform_role text;
  platform_role_active boolean;
  profile_role text;
  profile_status text;
  organization_role text;
begin
  if uid is null then
    return null;
  end if;

  select ur.role, ur.is_active
  into platform_role, platform_role_active
  from public.user_roles ur
  where ur.user_id = uid
  limit 1;

  select p.role, p.status
  into profile_role, profile_status
  from public.profiles p
  where p.id = uid
  limit 1;

  -- La membresia solo importa cuando la plataforma no dio un rol operativo,
  -- que es exactamente cuando el middleware hacia la tercera consulta.
  if coalesce(platform_role, profile_role, 'cliente') = 'cliente' then
    select om.role
    into organization_role
    from public.organization_members om
    where om.user_id = uid
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager', 'cashier', 'technician', 'seller')
      and (p_organization_id is null or om.organization_id = p_organization_id)
    order by om.created_at asc
    limit 1;
  end if;

  return jsonb_build_object(
    'platformRole', platform_role,
    'platformRoleActive', coalesce(platform_role_active, true),
    'profileRole', profile_role,
    'profileStatus', profile_status,
    'organizationRole', organization_role
  );
end;
$$;

revoke all on function public.resolve_middleware_access(uuid) from public, anon;
grant execute on function public.resolve_middleware_access(uuid) to authenticated;

commit;
