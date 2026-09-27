-- Customer segments: aislamiento por organización + formato de reglas del frontend
-- Fecha: 2026-06-12
-- Descripción:
--   La tabla customer_segments (creada en 20241213_customer_segmentation_setup.sql)
--   no tenía organization_id ni RLS por organización: era compartida entre TODAS
--   las organizaciones. Además el frontend modela las reglas como un array
--   SegmentRule[] (field/operator/value/type), distinto al JSONB `criteria` legacy.
--
--   Esta migración:
--     1. Garantiza que la tabla exista (por si la migración legacy no se aplicó).
--     2. Agrega organization_id, rules (jsonb) y ai_suggested.
--     3. Crea índice por (organization_id, priority).
--     4. Reemplaza las políticas RLS abiertas (USING true) por políticas
--        restringidas a los miembros de la organización (public.get_org_role).
--
-- Idempotente: segura de re-ejecutar.

-- 1. Asegurar que la tabla exista (esquema mínimo compatible con la legacy)
create table if not exists public.customer_segments (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) not null,
    description text,
    criteria jsonb not null default '{}',
    color varchar(7) not null default '#45B7D1',
    icon varchar(50) not null default 'target',
    is_active boolean not null default true,
    auto_update boolean not null default true,
    priority integer not null default 1,
    tags text[] default '{}',
    created_by uuid references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Columnas nuevas
alter table public.customer_segments
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.customer_segments
  add column if not exists rules jsonb not null default '[]';

alter table public.customer_segments
  add column if not exists ai_suggested boolean not null default false;

-- 3. Índices
create index if not exists idx_customer_segments_org_priority
  on public.customer_segments(organization_id, priority);

-- 4. RLS por organización: reemplaza las políticas abiertas legacy
alter table public.customer_segments enable row level security;

drop policy if exists "Users can view all segments" on public.customer_segments;
drop policy if exists "Users can create segments" on public.customer_segments;
drop policy if exists "Users can update segments" on public.customer_segments;
drop policy if exists "Users can delete segments" on public.customer_segments;

drop policy if exists "org members read segments" on public.customer_segments;
create policy "org members read segments" on public.customer_segments
for select using (public.get_org_role(organization_id) is not null);

drop policy if exists "org members create segments" on public.customer_segments;
create policy "org members create segments" on public.customer_segments
for insert with check (public.get_org_role(organization_id) is not null);

drop policy if exists "org members update segments" on public.customer_segments;
create policy "org members update segments" on public.customer_segments
for update using (public.get_org_role(organization_id) is not null)
with check (public.get_org_role(organization_id) is not null);

drop policy if exists "org members delete segments" on public.customer_segments;
create policy "org members delete segments" on public.customer_segments
for delete using (public.get_org_role(organization_id) is not null);

-- 5. Documentación
comment on column public.customer_segments.organization_id is 'Organización dueña del segmento (multi-tenant)';
comment on column public.customer_segments.rules is 'Reglas de segmentación en formato SegmentRule[] del frontend (field/operator/value/type)';
comment on column public.customer_segments.ai_suggested is 'true si el segmento fue sugerido automáticamente';
