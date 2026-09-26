-- Analítica web propia: visitas e interacciones de las tiendas públicas
-- (/[organizationSlug]/...) y del marketplace.
-- Solo el service_role escribe y lee (vía /api/public/analytics/track y los
-- endpoints de admin/superadmin); RLS sin políticas bloquea anon/authenticated.

create table if not exists public.site_analytics_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  site text not null check (site in ('storefront', 'marketplace')),
  event_type text not null check (
    event_type in ('page_view', 'whatsapp_click', 'phone_click', 'add_to_cart', 'order_placed')
  ),
  path text not null,
  page_type text,
  entity_id text,
  visitor_id text not null,
  session_id text not null,
  referrer_host text,
  utm_source text,
  device text check (device in ('mobile', 'tablet', 'desktop')),
  country text,
  created_at timestamptz not null default now()
);

create index if not exists site_analytics_events_org_created_idx
  on public.site_analytics_events (organization_id, created_at desc);

create index if not exists site_analytics_events_site_created_idx
  on public.site_analytics_events (site, created_at desc);

create index if not exists site_analytics_events_created_brin_idx
  on public.site_analytics_events using brin (created_at);

alter table public.site_analytics_events enable row level security;

revoke all on table public.site_analytics_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resumen para los dashboards. p_organization_id null = toda la plataforma.
-- ---------------------------------------------------------------------------
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
      'visitors', (select count(distinct visitor_id) from prev_pv)
    ),
    'active_now', (
      select count(distinct visitor_id)
      from ev
      where created_at >= now() - interval '5 minutes'
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
        select source, count(*) as sessions
        from session_sources
        group by source
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
    'interactions', jsonb_build_object(
      'whatsapp_click', (select count(*) from ev where event_type = 'whatsapp_click'),
      'phone_click', (select count(*) from ev where event_type = 'phone_click'),
      'add_to_cart', (select count(*) from ev where event_type = 'add_to_cart'),
      'order_placed', (select count(*) from ev where event_type = 'order_placed')
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
               count(*) as page_views,
               count(distinct pv.visitor_id) as visitors,
               count(*) filter (where pv.site = 'marketplace') as marketplace_views
        from pv
        join public.organizations o on o.id = pv.organization_id
        group by o.id, o.name, o.slug
        order by count(*) desc
        limit 25
      ) t
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_site_analytics_summary(integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.get_site_analytics_summary(integer, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Retención: los eventos crudos se conservan 13 meses.
-- ---------------------------------------------------------------------------
create or replace function public.purge_site_analytics_events(p_keep_days integer default 395)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.site_analytics_events
  where created_at < now() - make_interval(days => greatest(p_keep_days, 30));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_site_analytics_events(integer) from public, anon, authenticated;
grant execute on function public.purge_site_analytics_events(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge-site-analytics-events')
    where exists (select 1 from cron.job where jobname = 'purge-site-analytics-events');

    perform cron.schedule(
      'purge-site-analytics-events',
      '17 4 * * *',
      'select public.purge_site_analytics_events()'
    );
  end if;
end $$;
