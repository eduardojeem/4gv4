-- Sesiones reales del usuario logueado (Perfil → Seguridad → Sesiones y dispositivos).
--
-- La lista se armaba con public.user_sessions, una tabla que escribe el propio
-- navegador con un id derivado del token de acceso (que cambia en cada renovación):
-- quedaban filas repetidas, faltaban las sesiones de la app y «cerrar» sólo marcaba
-- la fila mientras el equipo seguía logueado. Estas funciones leen y cortan las
-- sesiones de Supabase Auth (auth.sessions), siempre limitadas a auth.uid().
--
-- Aditiva: no cambia tablas ni políticas de RLS. Cortar una sesión borra su fila
-- (y en cascada sus refresh tokens): ese equipo no puede renovar y Supabase Auth
-- rechaza su token en getUser().

create or replace function public.list_my_auth_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as last_active_at,
    s.user_agent,
    host(s.ip) as ip,
    s.aal::text as aal
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) desc
  limit 100;
$$;

create or replace function public.revoke_my_auth_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  delete from auth.sessions s
  where s.id = p_session_id
    and s.user_id = (select auth.uid());

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.list_my_auth_sessions() from public, anon;
revoke all on function public.revoke_my_auth_session(uuid) from public, anon;
grant execute on function public.list_my_auth_sessions() to authenticated;
grant execute on function public.revoke_my_auth_session(uuid) to authenticated;
