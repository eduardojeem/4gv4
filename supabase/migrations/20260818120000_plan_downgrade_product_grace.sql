-- Ciclo de gracia al degradar de plan.
--
-- Al bajar de plan, la organizacion puede quedar con mas productos activos que
-- los que su plan permite. En vez de cortar de golpe se abre un ciclo:
--
--   1. Se detecta el excedente y se abre una ventana de 7 dias.
--   2. Vencidos los 7 dias se desactivan los excedentes, conservando activos los
--      mas vendidos hasta el cupo del plan.
--   3. Se abren 30 dias mas para regularizar y recuperarlos.
--   4. Vencidos los 30 dias se archivan definitivamente.
--
-- Sobre el paso 4: NO se borran las filas. `sale_items.product_id` y
-- `sale_item_cost_snapshots.product_id` bloquean el delete de cualquier producto
-- que se haya vendido alguna vez, y forzarlo destruiria el historico de ventas y
-- los reportes financieros. El archivado definitivo saca el producto de toda
-- pantalla operativa y libera cupo, que es el efecto buscado, sin romper la
-- contabilidad.

begin;

-- ── Estado del ciclo, uno por organizacion ────────────────────────────────────
create table if not exists public.plan_downgrade_grace (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_code text not null,
  product_limit integer not null check (product_limit >= 0),
  -- Productos activos en el momento de detectar el excedente.
  active_products_at_start integer not null check (active_products_at_start >= 0),
  stage text not null default 'grace'
    check (stage in ('grace', 'deactivated', 'archived', 'resolved')),
  grace_started_at timestamptz not null default now(),
  grace_ends_at timestamptz not null,
  deactivated_at timestamptz,
  archive_deadline_at timestamptz,
  archived_at timestamptz,
  resolved_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_downgrade_grace_stage
  on public.plan_downgrade_grace (stage, grace_ends_at);

alter table public.plan_downgrade_grace enable row level security;

drop policy if exists "tenant members read plan downgrade grace" on public.plan_downgrade_grace;
create policy "tenant members read plan downgrade grace"
  on public.plan_downgrade_grace for select
  using (public.is_org_member(organization_id));

-- ── Marcas en products ────────────────────────────────────────────────────────
-- `deactivated_by_plan` distingue lo apagado por el ciclo de lo que el usuario
-- apago a mano: al regularizar solo se reactiva lo primero.
alter table public.products
  add column if not exists deactivated_by_plan boolean not null default false,
  add column if not exists archived_by_plan_at timestamptz;

create index if not exists idx_products_deactivated_by_plan
  on public.products (organization_id)
  where deactivated_by_plan = true;

-- ── Ranking de mas vendidos ───────────────────────────────────────────────────
-- Unidades vendidas historicas. Un producto sin ventas queda ultimo, que es el
-- orden correcto para decidir cual conservar.
create or replace function public.rank_products_by_sales(p_organization_id uuid)
returns table (product_id uuid, units_sold numeric)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id as product_id,
    coalesce(sum(si.quantity), 0)::numeric as units_sold
  from public.products p
  left join public.sale_items si on si.product_id = p.id
  left join public.sales s on s.id = si.sale_id
    and s.organization_id = p.organization_id
    and coalesce(lower(s.status), '') <> 'cancelado'
  where p.organization_id = p_organization_id
  group by p.id
$$;

-- ── 1. Abrir el ciclo al detectar excedente ───────────────────────────────────
create or replace function public.open_plan_downgrade_grace(
  p_organization_id uuid,
  p_plan_code text,
  p_product_limit integer
)
returns public.plan_downgrade_grace
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  active_count integer;
  existing public.plan_downgrade_grace;
  result public.plan_downgrade_grace;
begin
  if p_product_limit is null then
    return null; -- plan sin limite: nada que regularizar
  end if;

  select count(*) into active_count
  from public.products
  where organization_id = p_organization_id
    and is_active = true
    and archived_by_plan_at is null;

  if active_count <= p_product_limit then
    -- Entra en el cupo: si habia un ciclo abierto, se cierra.
    delete from public.plan_downgrade_grace where organization_id = p_organization_id;
    return null;
  end if;

  select * into existing
  from public.plan_downgrade_grace
  where organization_id = p_organization_id;

  -- Un ciclo en curso no se reinicia: reabrir la ventana en cada visita dejaria
  -- el plazo corriendo para siempre.
  if existing.organization_id is not null and existing.stage <> 'resolved' then
    return existing;
  end if;

  insert into public.plan_downgrade_grace as g (
    organization_id, plan_code, product_limit, active_products_at_start,
    stage, grace_started_at, grace_ends_at
  )
  values (
    p_organization_id, p_plan_code, p_product_limit, active_count,
    'grace', now(), now() + interval '7 days'
  )
  on conflict (organization_id) do update set
    plan_code = excluded.plan_code,
    product_limit = excluded.product_limit,
    active_products_at_start = excluded.active_products_at_start,
    stage = 'grace',
    grace_started_at = now(),
    grace_ends_at = now() + interval '7 days',
    deactivated_at = null,
    archive_deadline_at = null,
    archived_at = null,
    resolved_at = null,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

-- ── 3. Desactivar excedentes conservando los mas vendidos ─────────────────────
create or replace function public.enforce_plan_downgrade_deactivation(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  grace_row public.plan_downgrade_grace;
  affected integer := 0;
begin
  select * into grace_row
  from public.plan_downgrade_grace
  where organization_id = p_organization_id
    and stage = 'grace'
  for update;

  if grace_row.organization_id is null then
    return 0;
  end if;

  with ranked as (
    select
      r.product_id,
      row_number() over (order by r.units_sold desc, p.created_at asc) as position
    from public.rank_products_by_sales(p_organization_id) r
    join public.products p on p.id = r.product_id
    where p.is_active = true
      and p.archived_by_plan_at is null
  )
  update public.products p
  set is_active = false,
      deactivated_by_plan = true,
      updated_at = now()
  from ranked
  where ranked.product_id = p.id
    and ranked.position > grace_row.product_limit;

  get diagnostics affected = row_count;

  update public.plan_downgrade_grace
  set stage = 'deactivated',
      deactivated_at = now(),
      archive_deadline_at = now() + interval '30 days',
      updated_at = now()
  where organization_id = p_organization_id;

  return affected;
end;
$$;

-- ── 5. Archivado definitivo del excedente ─────────────────────────────────────
create or replace function public.enforce_plan_downgrade_archive(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  affected integer := 0;
begin
  update public.products
  set archived_by_plan_at = now(),
      updated_at = now()
  where organization_id = p_organization_id
    and deactivated_by_plan = true
    and archived_by_plan_at is null;

  get diagnostics affected = row_count;

  update public.plan_downgrade_grace
  set stage = 'archived',
      archived_at = now(),
      updated_at = now()
  where organization_id = p_organization_id;

  return affected;
end;
$$;

-- ── Regularizacion: devolver todo al estado previo ────────────────────────────
create or replace function public.resolve_plan_downgrade_grace(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  restored integer := 0;
begin
  -- Solo se reactiva lo que apago el ciclo: lo que el usuario desactivo a mano
  -- sigue como el lo dejo.
  update public.products
  set is_active = true,
      deactivated_by_plan = false,
      archived_by_plan_at = null,
      updated_at = now()
  where organization_id = p_organization_id
    and deactivated_by_plan = true;

  get diagnostics restored = row_count;

  update public.plan_downgrade_grace
  set stage = 'resolved',
      resolved_at = now(),
      updated_at = now()
  where organization_id = p_organization_id;

  return restored;
end;
$$;

-- ── Barrido periodico ─────────────────────────────────────────────────────────
create or replace function public.process_plan_downgrade_grace()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target record;
  processed integer := 0;
begin
  for target in
    select organization_id, stage
    from public.plan_downgrade_grace
    where (stage = 'grace' and grace_ends_at <= now())
       or (stage = 'deactivated' and archive_deadline_at <= now())
    order by grace_ends_at asc
    for update skip locked
  loop
    if target.stage = 'grace' then
      perform public.enforce_plan_downgrade_deactivation(target.organization_id);
    else
      perform public.enforce_plan_downgrade_archive(target.organization_id);
    end if;
    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_plan_downgrade_grace() from public, anon, authenticated;
grant execute on function public.process_plan_downgrade_grace() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('process-plan-downgrade-grace')
    where exists (select 1 from cron.job where jobname = 'process-plan-downgrade-grace');

    perform cron.schedule(
      'process-plan-downgrade-grace',
      '15 * * * *',
      'select public.process_plan_downgrade_grace()'
    );
  end if;
end $$;

commit;
