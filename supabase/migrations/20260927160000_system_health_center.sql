-- Centro de diagnóstico del SuperAdmin (/superadmin/system-health).
--
-- Antes de crear nada se revisó el esquema real (spec OpenAPI de PostgREST,
-- 157 tablas / 184 RPC al 2026-09-27):
--   * No existe una tabla de historial de comprobaciones. `audit_log` registra
--     acciones de usuarios y el panel /superadmin/monitoring cuenta sus filas
--     por severidad: mezclar ahí resultados de diagnóstico falsearía esos
--     contadores.
--   * El webhook de Pagopar no deja rastro cuando rechaza o falla: solo se
--     puede saber cuándo se aplicó un pago. Sin un registro propio es imposible
--     mostrar "última recepción" o "último error".
--   * Ninguna RPC expone el estado de RLS ni el texto de las políticas. Las
--     RPC de monitoreo existentes (get_table_sizes, get_database_stats, ...)
--     solo miden tamaño y conexiones. La migración
--     20260927140000_close_cross_tenant_read_leak muestra por qué hace falta
--     el texto: el Security Advisor no detecta políticas que existen pero no
--     filtran por organización.
--
-- Todo es de solo lectura para la app salvo los dos INSERT de registro, y
-- solo accesible con service_role. No se toca ninguna política existente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Historial de comprobaciones
-- ---------------------------------------------------------------------------

create table if not exists public.system_health_checks (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  checked_at timestamptz not null default now(),
  check_id text not null,
  category text not null,
  status text not null
    check (status in ('healthy', 'warning', 'error', 'not_configured', 'unknown')),
  severity text not null
    check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  message text not null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  triggered_by uuid references auth.users (id) on delete set null
);

comment on table public.system_health_checks is
  'Resultados de /superadmin/system-health. Solo service_role. metadata nunca guarda secretos.';

create index if not exists system_health_checks_checked_at_idx
  on public.system_health_checks (checked_at desc);
create index if not exists system_health_checks_run_id_idx
  on public.system_health_checks (run_id);
create index if not exists system_health_checks_category_idx
  on public.system_health_checks (category, checked_at desc);

alter table public.system_health_checks enable row level security;
revoke all on table public.system_health_checks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registro de webhooks de pago
-- ---------------------------------------------------------------------------

create table if not exists public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  endpoint text not null,
  outcome text not null check (outcome in ('processed', 'ignored', 'rejected', 'error')),
  http_status integer not null,
  error_code text,
  received_at timestamptz not null default now()
);

comment on table public.payment_webhook_events is
  'Una fila por notificación recibida. Nunca guarda payload, tokens ni firmas.';

create index if not exists payment_webhook_events_provider_idx
  on public.payment_webhook_events (provider, received_at desc);

alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Catálogo de seguridad (solo lectura, solo agregados)
-- ---------------------------------------------------------------------------

create or replace function public.get_system_health_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tables jsonb;
  v_views jsonb;
  v_definer jsonb;
  v_buckets jsonb := '[]'::jsonb;
  v_auth jsonb := null;
  v_migrations jsonb := null;
begin
  select coalesce(jsonb_agg(t order by t->>'name'), '[]'::jsonb)
  into v_tables
  from (
    select jsonb_build_object(
      'name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'has_organization_id', exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
      ),
      'has_branch_id', exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = c.oid and a.attname = 'branch_id' and not a.attisdropped
      ),
      'estimated_rows', greatest(c.reltuples, 0)::bigint,
      'anon_select', pg_catalog.has_table_privilege('anon', c.oid, 'SELECT'),
      'authenticated_select', pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT'),
      'policies', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', p.policyname,
          'command', p.cmd,
          'permissive', p.permissive = 'PERMISSIVE',
          'roles', to_jsonb(p.roles),
          'using', p.qual,
          'with_check', p.with_check
        ) order by p.policyname)
        from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      ), '[]'::jsonb)
    ) as t
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  ) s;

  select coalesce(jsonb_agg(v order by v->>'name'), '[]'::jsonb)
  into v_views
  from (
    select jsonb_build_object(
      'name', c.relname,
      'kind', case c.relkind when 'm' then 'materialized' else 'view' end,
      'security_invoker', coalesce(
        exists (
          select 1 from unnest(c.reloptions) o
          where lower(o) in ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
        ), false),
      'has_organization_id', exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
      ),
      'anon_select', pg_catalog.has_table_privilege('anon', c.oid, 'SELECT'),
      'authenticated_select', pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
    ) as v
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  ) s;

  select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
  into v_definer
  from (
    select p.proname::text as f
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    group by p.proname
  ) s;

  if to_regclass('storage.buckets') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'public', b.public,
        'file_size_limit', b.file_size_limit,
        'object_count', coalesce(o.object_count, 0),
        'total_bytes', coalesce(o.total_bytes, 0)
      ) order by b.id), '[]'::jsonb)
      from storage.buckets b
      left join (
        select bucket_id,
               count(*)::bigint as object_count,
               coalesce(sum((metadata->>'size')::bigint), 0)::bigint as total_bytes
        from storage.objects
        group by bucket_id
      ) o on o.bucket_id = b.id
    $q$ into v_buckets;
  end if;

  if to_regclass('auth.users') is not null then
    execute $q$
      select jsonb_build_object(
        'total', count(*),
        'confirmed', count(*) filter (where email_confirmed_at is not null),
        'banned', count(*) filter (where banned_until is not null and banned_until > now()),
        'signed_in_30d', count(*) filter (where last_sign_in_at >= now() - interval '30 days'),
        'created_30d', count(*) filter (where created_at >= now() - interval '30 days')
      )
      from auth.users
    $q$ into v_auth;
  end if;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $q$
      select jsonb_build_object('count', count(*), 'latest', max(version))
      from supabase_migrations.schema_migrations
    $q$ into v_migrations;
  end if;

  return jsonb_build_object(
    'collected_at', now(),
    'tables', v_tables,
    'views', v_views,
    'anon_security_definer_functions', v_definer,
    'storage_buckets', v_buckets,
    'auth_users', v_auth,
    'migrations', v_migrations
  );
end;
$$;

comment on function public.get_system_health_catalog() is
  'Inventario de RLS, políticas, vistas, buckets y agregados de auth para /superadmin/system-health. Solo lectura, solo service_role.';

revoke all on function public.get_system_health_catalog() from public, anon, authenticated;
grant execute on function public.get_system_health_catalog() to service_role;

commit;
