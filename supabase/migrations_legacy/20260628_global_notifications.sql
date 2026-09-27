-- Notificaciones globales del superadmin hacia las organizaciones.
-- Tabla creada y validada en Supabase dev (proyecto bznebbqusxfzajmolqfg).
-- Este archivo documenta/versiona el esquema ya aplicado.

create table if not exists public.global_notifications (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  type            text not null default 'info'
                    check (type in ('info', 'warning', 'success', 'danger')),
  target          text not null default 'all'
                    check (target in ('all', 'specific')),
  target_org_ids  uuid[],
  status          text not null default 'draft'
                    check (status in ('draft', 'scheduled', 'sent')),
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists global_notifications_status_idx
  on public.global_notifications using btree (status);

create index if not exists global_notifications_created_at_idx
  on public.global_notifications using btree (created_at desc);

alter table public.global_notifications enable row level security;

-- Solo el superadmin gestiona estas notificaciones desde el service-role.
-- (Las rutas de superadmin usan createAdminSupabase / service key.)
drop policy if exists superadmin_full_access on public.global_notifications;
create policy superadmin_full_access
  on public.global_notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
