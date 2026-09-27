-- Analítica web: ingresos por fuente de tráfico y búsquedas de los visitantes.

alter table public.site_analytics_events
  add column if not exists value numeric(14, 2),
  add column if not exists search_term text,
  add column if not exists results_count integer;

alter table public.site_analytics_events
  drop constraint if exists site_analytics_events_event_type_check;

alter table public.site_analytics_events
  add constraint site_analytics_events_event_type_check check (
    event_type in ('page_view', 'whatsapp_click', 'phone_click', 'add_to_cart', 'order_placed', 'search')
  );

-- Un pedido se cuenta una sola vez aunque el navegador reenvíe el evento.
-- Los eventos anteriores no referenciaban el pedido: se desvinculan duplicados
-- para que el índice pueda crearse.
update public.site_analytics_events e
set entity_id = null
where e.event_type = 'order_placed'
  and e.entity_id is not null
  and exists (
    select 1
    from public.site_analytics_events d
    where d.event_type = 'order_placed'
      and d.entity_id = e.entity_id
      and d.id < e.id
  );

create unique index if not exists site_analytics_events_order_once_idx
  on public.site_analytics_events (entity_id)
  where event_type = 'order_placed';

create or replace function public.get_site_analytics_summary(
  p_days integer default 30,
  p_organization_id uuid default null,
  p_site text default null,
  p_tz text default 'America/Asuncion'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 366);
  v_today date := (now() at time zone p_tz)::date;
  v_first_day date := v_today - (v_days - 1);
  v_from timestamptz := v_first_day::timestamp at time zone p_tz;
  v_prev_from timestamptz := (v_first_day - v_days)::timestamp at time zone p_tz;
  v_result jsonb;
begin
  with scoped as (
    select *
    from public.site_analytics_events e
    where e.created_at >= v_prev_from
      and (p_organization_id is null or e.organization_id = p_organization_id)
      and (p_site is null or e.site = p_site)
  ),
  ev as (
    select * from scoped where created_at >= v_from
  ),
  pv as (
    select * from ev where event_type = 'page_view'
  ),
  prev_pv as (
    select * from scoped where created_at < v_from and event_type = 'page_view'
  ),
  orders as (
    select session_id, organization_id, coalesce(value, 0) as value
    from ev
    where event_type = 'order_placed'
  ),
  searches as (
    select session_id, search_term, results_count
    from ev
    where event_type = 'search' and search_term is not null
  ),
  sessions as (
    select session_id, count(*) as views
    from pv
    group by session_id
  ),
  session_sources as (
    select distinct on (session_id)
      session_id,
      coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'directo') as source,
      coalesce(device, 'desktop') as device
    from pv
    order by session_id, created_at
  ),
  session_orders as (
    select session_id, count(*) as orders, sum(value) as revenue
    from orders
    group by session_id
  ),
  session_flags as (
    select
      session_id,
      bool_or(event_type = 'page_view') as viewed,
      bool_or(event_type = 'page_view' and page_type = 'producto') as viewed_product,
      bool_or(event_type = 'add_to_cart') as added_to_cart,
      bool_or(event_type in ('order_placed', 'whatsapp_click', 'phone_click')) as contacted_or_ordered
    from ev
    group by session_id
  )
  select jsonb_build_object(
    'range', jsonb_build_object('days', v_days, 'from', v_first_day, 'to', v_today, 'timezone', p_tz),
    'totals', jsonb_build_object(
      'page_views', (select count(*) from pv),
      'visitors', (select count(distinct visitor_id) from pv),
      'sessions', (select count(*) from sessions),
      'bounce_rate', coalesce((
        select round(100.0 * count(*) filter (where views = 1) / nullif(count(*), 0), 1)
        from sessions
      ), 0),
      'pages_per_session', coalesce((select round(avg(views)::numeric, 2) from sessions), 0)
    ),
    'previous', jsonb_build_object(
      'page_views', (select count(*) from prev_pv),
      'visitors', (select count(distinct visitor_id) from prev_pv),
      'orders', (select count(*) from scoped where created_at < v_from and event_type = 'order_placed'),
      'revenue', (
        select coalesce(sum(value), 0)
        from scoped
        where created_at < v_from and event_type = 'order_placed'
      )
    ),
    'active_now', (
      select count(distinct visitor_id)
      from ev
      where created_at >= now() - interval '5 minutes'
    ),
    'sales', jsonb_build_object(
      'orders', (select count(*) from orders),
      'revenue', (select coalesce(sum(value), 0) from orders),
      'average_order_value', coalesce((select round(avg(value), 2) from orders), 0),
      'conversion_rate', coalesce((
        select round(100.0 * (select count(distinct session_id) from orders) / nullif(count(*), 0), 2)
        from sessions
      ), 0)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.day,
        'page_views', coalesce(x.page_views, 0),
        'visitors', coalesce(x.visitors, 0)
      ) order by d.day), '[]'::jsonb)
      from generate_series(v_first_day, v_today, interval '1 day') as g(ts)
      cross join lateral (select g.ts::date as day) d
      left join (
        select (created_at at time zone p_tz)::date as day,
               count(*) as page_views,
               count(distinct visitor_id) as visitors
        from pv
        group by 1
      ) x on x.day = d.day
    ),
    'top_pages', (
      select coalesce(jsonb_agg(t order by t.page_views desc), '[]'::jsonb)
      from (
        select x.path, x.page_type, p.name as product_name, x.page_views, x.visitors
        from (
          select path,
                 max(page_type) as page_type,
                 max(entity_id) as entity_id,
                 count(*) as page_views,
                 count(distinct visitor_id) as visitors
          from pv
          group by path
          order by count(*) desc
          limit 10
        ) x
        left join public.products p on p.id::text = x.entity_id
      ) t
    ),
    'top_products', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb)
      from (
        select x.entity_id as product_id, p.name, x.views, x.add_to_cart
        from (
          select entity_id,
                 count(*) filter (where event_type = 'page_view') as views,
                 count(*) filter (where event_type = 'add_to_cart') as add_to_cart
          from ev
          where entity_id is not null
            and (page_type = 'producto' or event_type = 'add_to_cart')
          group by entity_id
        ) x
        left join public.products p on p.id::text = x.entity_id
        order by x.views desc, x.add_to_cart desc
        limit 10
      ) t
    ),
    'sources', (
      select coalesce(jsonb_agg(t order by t.sessions desc), '[]'::jsonb)
      from (
        select s.source,
               count(*) as sessions,
               coalesce(sum(o.orders), 0) as orders,
               coalesce(sum(o.revenue), 0) as revenue
        from session_sources s
        left join session_orders o on o.session_id = s.session_id
        group by s.source
        order by count(*) desc
        limit 10
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t order by t.sessions desc), '[]'::jsonb)
      from (
        select device, count(*) as sessions
        from session_sources
        group by device
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t order by t.visitors desc), '[]'::jsonb)
      from (
        select coalesce(country, '??') as country, count(distinct visitor_id) as visitors
        from pv
        group by 1
        order by count(distinct visitor_id) desc
        limit 10
      ) t
    ),
    'searches', jsonb_build_object(
      'total', (select count(*) from searches),
      'without_results', (select count(*) from searches where results_count = 0),
      'top_terms', (
        select coalesce(jsonb_agg(t order by t.searches desc), '[]'::jsonb)
        from (
          select search_term as term,
                 count(*) as searches,
                 count(distinct session_id) as sessions,
                 round(avg(results_count)::numeric, 1) as avg_results
          from searches
          group by search_term
          order by count(*) desc
          limit 15
        ) t
      ),
      'without_results_terms', (
        select coalesce(jsonb_agg(t order by t.searches desc), '[]'::jsonb)
        from (
          select search_term as term, count(*) as searches
          from searches
          where results_count = 0
          group by search_term
          order by count(*) desc
          limit 15
        ) t
      )
    ),
    'interactions', jsonb_build_object(
      'whatsapp_click', (select count(*) from ev where event_type = 'whatsapp_click'),
      'phone_click', (select count(*) from ev where event_type = 'phone_click'),
      'add_to_cart', (select count(*) from ev where event_type = 'add_to_cart'),
      'order_placed', (select count(*) from orders)
    ),
    'funnel', jsonb_build_object(
      'sessions', (select count(*) from session_flags where viewed),
      'viewed_product', (select count(*) from session_flags where viewed and viewed_product),
      'added_to_cart', (select count(*) from session_flags where viewed and added_to_cart),
      'contacted_or_ordered', (select count(*) from session_flags where viewed and contacted_or_ordered)
    ),
    'by_site', (
      select coalesce(jsonb_agg(t order by t.page_views desc), '[]'::jsonb)
      from (
        select site, count(*) as page_views, count(distinct visitor_id) as visitors
        from pv
        group by site
      ) t
    ),
    'top_organizations', (
      select coalesce(jsonb_agg(t order by t.page_views desc), '[]'::jsonb)
      from (
        select o.id as organization_id, o.name, o.slug,
               v.page_views, v.visitors, v.marketplace_views,
               coalesce(r.orders, 0) as orders,
               coalesce(r.revenue, 0) as revenue
        from (
          select organization_id,
                 count(*) as page_views,
                 count(distinct visitor_id) as visitors,
                 count(*) filter (where site = 'marketplace') as marketplace_views
          from pv
          where organization_id is not null
          group by organization_id
          order by count(*) desc
          limit 25
        ) v
        join public.organizations o on o.id = v.organization_id
        left join (
          select organization_id, count(*) as orders, sum(value) as revenue
          from orders
          group by organization_id
        ) r on r.organization_id = v.organization_id
      ) t
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_site_analytics_summary(integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.get_site_analytics_summary(integer, uuid, text, text) to service_role;
