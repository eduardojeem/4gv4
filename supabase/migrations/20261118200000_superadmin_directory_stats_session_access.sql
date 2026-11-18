-- Último acceso del equipo: contar también las sesiones que se renuevan solas.
--
-- `auth.users.last_sign_in_at` solo cambia al iniciar sesión. Quien deja la
-- sesión abierta (la caja, la PWA o la app del celular) usa el sistema todos
-- los días sin volver a iniciar sesión, y el listado lo marcaba «sin acceso».
-- Se toma la actividad más reciente entre el último inicio de sesión y la
-- última renovación de cualquiera de sus sesiones, con el mismo criterio que
-- `list_my_auth_sessions()`.
--
-- Mismo contrato que la versión anterior: solo service_role, sin cambios de RLS.

create or replace function public.superadmin_organization_directory_stats()
returns table (
  organization_id uuid,
  members_total integer,
  members_active integer,
  members_invited integer,
  members_suspended integer,
  staff_total integer,
  staff_active integer,
  staff_invited integer,
  staff_suspended integer,
  customers_total integer,
  team_size integer,
  last_access_at timestamptz,
  last_sale_at timestamptz,
  products_total integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  with members as (
    select
      m.organization_id,
      count(*)::int as members_total,
      count(*) filter (where m.status = 'active')::int as members_active,
      count(*) filter (where m.status = 'invited')::int as members_invited,
      count(*) filter (where m.status = 'suspended')::int as members_suspended,
      count(*) filter (where m.role::text <> 'customer')::int as staff_total,
      count(*) filter (where m.role::text <> 'customer' and m.status = 'active')::int as staff_active,
      count(*) filter (where m.role::text <> 'customer' and m.status = 'invited')::int as staff_invited,
      count(*) filter (where m.role::text <> 'customer' and m.status = 'suspended')::int as staff_suspended,
      count(*) filter (where m.role::text = 'customer')::int as customers_total
    from public.organization_members m
    group by m.organization_id
  ),
  team as (
    select o.id as organization_id, o.owner_id as user_id
    from public.organizations o
    where o.owner_id is not null
    union
    select m.organization_id, m.user_id
    from public.organization_members m
    where m.role::text <> 'customer' and m.user_id is not null
  ),
  -- Última renovación de sesión por usuario (solo del equipo).
  session_activity as (
    select s.user_id, max(coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at)) as last_active_at
    from auth.sessions s
    where s.user_id in (select t.user_id from team t)
    group by s.user_id
  ),
  access as (
    select
      t.organization_id,
      count(*)::int as team_size,
      max(greatest(u.last_sign_in_at, sa.last_active_at)) as last_access_at
    from team t
    left join auth.users u on u.id = t.user_id
    left join session_activity sa on sa.user_id = t.user_id
    group by t.organization_id
  ),
  products as (
    select p.organization_id, count(*)::int as products_total
    from public.products p
    group by p.organization_id
  )
  select
    o.id,
    coalesce(mb.members_total, 0),
    coalesce(mb.members_active, 0),
    coalesce(mb.members_invited, 0),
    coalesce(mb.members_suspended, 0),
    coalesce(mb.staff_total, 0),
    coalesce(mb.staff_active, 0),
    coalesce(mb.staff_invited, 0),
    coalesce(mb.staff_suspended, 0),
    coalesce(mb.customers_total, 0),
    coalesce(a.team_size, 0),
    a.last_access_at,
    (select s.created_at from public.sales s
      where s.organization_id = o.id
      order by s.created_at desc
      limit 1),
    coalesce(pr.products_total, 0)
  from public.organizations o
  left join members mb on mb.organization_id = o.id
  left join access a on a.organization_id = o.id
  left join products pr on pr.organization_id = o.id;
$$;

revoke all on function public.superadmin_organization_directory_stats() from public, anon, authenticated;
grant execute on function public.superadmin_organization_directory_stats() to service_role;
