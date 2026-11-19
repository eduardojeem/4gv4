-- Resumen por organización para el listado del superadmin.
--
-- Antes la página hacía 2 consultas por organización (última venta y conteo
-- de productos), leía todo `auth.users` en páginas de 1000 (clientes de las
-- tiendas incluidos, con un tope que hacía decir «Nunca entró» a quien sí
-- entró) y traía cada fila de `organization_members` solo para contarla.
-- Esta función devuelve una fila por organización con todo agregado.
--
-- Solo la usa el servidor con la service role: no se expone a anon ni a
-- authenticated y no cambia ninguna política RLS.

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
  -- El equipo (dueño + miembros que no son clientes de la tienda web): los
  -- clientes no dicen si la empresa usa el sistema.
  team as (
    select o.id as organization_id, o.owner_id as user_id
    from public.organizations o
    where o.owner_id is not null
    union
    select m.organization_id, m.user_id
    from public.organization_members m
    where m.role::text <> 'customer' and m.user_id is not null
  ),
  access as (
    select t.organization_id, count(*)::int as team_size, max(u.last_sign_in_at) as last_access_at
    from team t
    left join auth.users u on u.id = t.user_id
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
    -- Usa idx_sales_org_created (organization_id, created_at desc).
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

comment on function public.superadmin_organization_directory_stats() is
  'Conteos de equipo y clientes, último acceso del equipo, última venta y productos por organización. Solo service_role (listado del superadmin).';
