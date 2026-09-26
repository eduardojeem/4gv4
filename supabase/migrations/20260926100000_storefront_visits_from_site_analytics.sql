-- Un solo registro de visitas: el panel de Superadmin → Landing deja de leer
-- storefront_daily_visits y arma los mismos contadores diarios desde
-- site_analytics_events, con las mismas reglas:
--   * una persona se cuenta una vez por día, en la página por la que entró;
--   * carrito y seguimiento de pedido son trámite, no visita.
-- Los días que solo tiene el contador anterior (antes del registro nuevo) se
-- siguen mostrando desde storefront_daily_visits, si esa tabla existe.

create or replace function public.get_storefront_daily_visits(
  p_from date,
  p_to date,
  p_tz text default 'America/Asuncion'
)
returns table (organization_id uuid, day date, page text, views bigint, visitors bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with pv as (
    select
      e.organization_id,
      (e.created_at at time zone p_tz)::date as day,
      case
        when e.page_type in ('inicio', 'productos', 'producto', 'ofertas', 'servicios') then e.page_type
        else 'otra'
      end as page,
      e.visitor_id,
      e.created_at
    from public.site_analytics_events e
    where e.site = 'storefront'
      and e.event_type = 'page_view'
      and e.organization_id is not null
      and coalesce(e.page_type, '') not in ('carrito', 'track')
      and e.created_at >= (p_from::timestamp at time zone p_tz)
      and e.created_at < ((p_to + 1)::timestamp at time zone p_tz)
  ),
  entries as (
    select distinct on (organization_id, day, visitor_id) organization_id, day, page
    from pv
    order by organization_id, day, visitor_id, created_at
  ),
  view_counts as (
    select organization_id, day, page, count(*)::bigint as views
    from pv
    group by organization_id, day, page
  ),
  visitor_counts as (
    select organization_id, day, page, count(*)::bigint as visitors
    from entries
    group by organization_id, day, page
  )
  select v.organization_id, v.day, v.page, v.views, coalesce(x.visitors, 0)::bigint
  from view_counts v
  left join visitor_counts x using (organization_id, day, page);

  if to_regclass('public.storefront_daily_visits') is not null then
    return query execute $legacy$
      select l.organization_id, l.day, l.page, l.views::bigint, l.visitors::bigint
      from public.storefront_daily_visits l
      where l.day between $1 and $2
        and not exists (
          select 1
          from public.site_analytics_events e
          where e.site = 'storefront'
            and e.event_type = 'page_view'
            and e.organization_id = l.organization_id
            and (e.created_at at time zone $3)::date = l.day
        )
    $legacy$ using p_from, p_to, p_tz;
  end if;
end;
$$;

revoke all on function public.get_storefront_daily_visits(date, date, text) from public, anon, authenticated;
grant execute on function public.get_storefront_daily_visits(date, date, text) to service_role;
