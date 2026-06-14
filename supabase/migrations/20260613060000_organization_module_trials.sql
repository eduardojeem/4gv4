-- Prueba de módulos premium por 7 días, por organización.
-- Cada módulo se puede probar UNA sola vez por org (unique). Vence por timestamp
-- (se evalúa en lectura, sin cron). Los módulos en trial activo se suman a los del plan.

create table if not exists public.organization_module_trials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  unique (organization_id, module)
);

create index if not exists idx_org_module_trials_org
  on public.organization_module_trials(organization_id);

alter table public.organization_module_trials enable row level security;

-- Miembros de la org pueden ver sus trials.
drop policy if exists "tenant members read module trials" on public.organization_module_trials;
create policy "tenant members read module trials" on public.organization_module_trials
  for select using (public.is_org_member(organization_id));

-- Solo owner/admin pueden iniciar un trial.
drop policy if exists "owners admins create module trials" on public.organization_module_trials;
create policy "owners admins create module trials" on public.organization_module_trials
  for insert with check (public.get_org_role(organization_id) in ('owner', 'admin'));
