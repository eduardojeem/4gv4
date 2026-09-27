-- Visitas a las tiendas públicas.
--
-- No había ningún registro de quién entra a la página de una tienda: el
-- superadmin podía ver cuánto vende, pero no cuánta gente la visita ni cuántas
-- visitas terminan en un pedido.
--
-- Se guardan contadores por día y por tipo de página, no visitas sueltas: no
-- hay IP, navegador ni ningún dato de la persona.

create table if not exists public.storefront_daily_visits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  page text not null check (page in ('inicio', 'productos', 'producto', 'ofertas', 'servicios', 'otra')),
  -- Páginas vistas.
  views integer not null default 0 check (views >= 0),
  -- Personas distintas en el día: el navegador avisa la primera página que ve
  -- de esa tienda en el día, y se anota en la página donde entró.
  visitors integer not null default 0 check (visitors >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, day, page)
);

create index if not exists storefront_daily_visits_day_idx
  on public.storefront_daily_visits (day);

-- Sin políticas: solo el service role lee y escribe.
alter table public.storefront_daily_visits enable row level security;

-- Suma una visita de forma atómica. El día es el de Paraguay, igual que el de
-- las ventas en el panel.
create or replace function public.record_storefront_visit(
  p_organization_id uuid,
  p_page text,
  p_new_visitor boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.storefront_daily_visits (organization_id, day, page, views, visitors)
  values (
    p_organization_id,
    (now() at time zone 'America/Asuncion')::date,
    p_page,
    1,
    case when p_new_visitor then 1 else 0 end
  )
  on conflict (organization_id, day, page) do update
    set views = public.storefront_daily_visits.views + 1,
        visitors = public.storefront_daily_visits.visitors + excluded.visitors,
        updated_at = now();
$$;

revoke all on function public.record_storefront_visit(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.record_storefront_visit(uuid, text, boolean) to service_role;
