-- Migración: Registro persistente de errores del sistema y auditoría de incidencias
-- Permite almacenar fallos de cliente, servidor y renderizado para diagnosticar problemas en producción
-- sin depender de servicios pagos.

create table if not exists public.system_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'client', -- 'client' | 'server' | 'boundary' | 'edge'
  severity text not null default 'error', -- 'error' | 'fatal' | 'warn'
  error_name text not null,
  error_message text not null,
  error_stack text,
  digest text,
  url text,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  user_agent text,
  metadata jsonb default '{}'::jsonb
);

-- Índices para búsquedas y dashboard
create index if not exists idx_system_error_logs_created_at on public.system_error_logs(created_at desc);
create index if not exists idx_system_error_logs_source on public.system_error_logs(source);
create index if not exists idx_system_error_logs_severity on public.system_error_logs(severity);
create index if not exists idx_system_error_logs_org_id on public.system_error_logs(organization_id);

-- RLS
alter table public.system_error_logs enable row level security;

-- Cualquier usuario (autenticado o anónimo que use la app) puede insertar un reporte de error
drop policy if exists "system_error_logs_insert_policy" on public.system_error_logs;
create policy "system_error_logs_insert_policy" on public.system_error_logs
  for insert
  with check (true);

-- Solo SuperAdmin puede leer o consultar los logs
drop policy if exists "system_error_logs_select_superadmin" on public.system_error_logs;
create policy "system_error_logs_select_superadmin" on public.system_error_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

-- Comentario descriptivo para el catálogo de base de datos
comment on table public.system_error_logs is 'Registro de errores y excepciones no controladas de la aplicación para monitoreo y alertas.';
