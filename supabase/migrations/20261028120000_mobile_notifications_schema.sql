-- ============================================================================
-- Migración: Sistema de Notificaciones Móviles y Operativas Multi-Tenant
-- Tablas: push_devices, notification_preferences, notifications
-- NO APLICAR HASTA REVISIÓN Y AUTORIZACIÓN EXPRESA.
-- ============================================================================

-- 1. Tabla de Dispositivos Móviles (Tokens Push multi-dispositivo por usuario y organización)
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_token text not null,
  enabled boolean not null default true,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_user_org_device_key unique (user_id, organization_id, device_id)
);

comment on table public.push_devices is 'Registro de dispositivos móviles y tokens de notificación push asociados a un usuario y organización.';

create index if not exists push_devices_user_org_idx on public.push_devices (user_id, organization_id);
create index if not exists push_devices_token_idx on public.push_devices (push_token);

-- 2. Tabla de Preferencias de Notificación (por usuario, organización y tipo de evento)
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_org_user_type_key unique (organization_id, user_id, notification_type)
);

comment on table public.notification_preferences is 'Preferencias granulares de entrega de notificaciones por usuario y organización.';

create index if not exists notif_prefs_org_user_idx on public.notification_preferences (organization_id, user_id);

-- 3. Tabla de Notificaciones Operativas In-App (Persistidas por usuario y comercio)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  resource_type text,
  resource_id text,
  read_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint notifications_branch_scope_fkey foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete set null (branch_id)
);

comment on table public.notifications is 'Historial de notificaciones operativas dirigidas a usuarios de la organización.';

-- Índices de consulta de bandeja y orden cronológico
create index if not exists notifications_user_org_read_idx on public.notifications (user_id, organization_id, read_at);
create index if not exists notifications_user_org_feed_idx on public.notifications (user_id, organization_id, created_at desc);
create index if not exists notifications_org_created_idx on public.notifications (organization_id, created_at desc);

-- Índice parcial de idempotencia para evitar duplicados ante reintentos
create unique index if not exists notifications_idempotency_idx
  on public.notifications (organization_id, user_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================================
-- Habilitación de Row Level Security (RLS)
-- ============================================================================

alter table public.push_devices enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

-- ----------------------------------------------------------------------------
-- Políticas RLS: push_devices
-- El usuario solo gestiona sus propios dispositivos y debe ser miembro activo
-- ----------------------------------------------------------------------------

create policy "push_devices_select_own"
  on public.push_devices for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = push_devices.organization_id
        and om.status = 'active'
    )
  );

create policy "push_devices_insert_own"
  on public.push_devices for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = push_devices.organization_id
        and om.status = 'active'
    )
  );

create policy "push_devices_update_own"
  on public.push_devices for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = push_devices.organization_id
        and om.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = push_devices.organization_id
        and om.status = 'active'
    )
  );

create policy "push_devices_delete_own"
  on public.push_devices for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = push_devices.organization_id
        and om.status = 'active'
    )
  );

create policy "push_devices_service_role_all"
  on public.push_devices for all
  to service_role
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- Políticas RLS: notification_preferences
-- El usuario solo gestiona sus preferencias en organizaciones donde es miembro
-- ----------------------------------------------------------------------------

create policy "notification_preferences_select_own"
  on public.notification_preferences for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notification_preferences.organization_id
        and om.status = 'active'
    )
  );

create policy "notification_preferences_insert_own"
  on public.notification_preferences for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notification_preferences.organization_id
        and om.status = 'active'
    )
  );

create policy "notification_preferences_update_own"
  on public.notification_preferences for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notification_preferences.organization_id
        and om.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notification_preferences.organization_id
        and om.status = 'active'
    )
  );

create policy "notification_preferences_delete_own"
  on public.notification_preferences for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notification_preferences.organization_id
        and om.status = 'active'
    )
  );

create policy "notification_preferences_service_role_all"
  on public.notification_preferences for all
  to service_role
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- Políticas RLS: notifications
-- Lectura y actualización de read_at por el usuario; creación solo por service_role
-- ----------------------------------------------------------------------------

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notifications.organization_id
        and om.status = 'active'
    )
  );

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notifications.organization_id
        and om.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = notifications.organization_id
        and om.status = 'active'
    )
  );

create policy "notifications_service_role_all"
  on public.notifications for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- Triggers para actualización automática de updated_at
-- ============================================================================

drop trigger if exists update_push_devices_updated_at on public.push_devices;
create trigger update_push_devices_updated_at
  before update on public.push_devices
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_notification_preferences_updated_at on public.notification_preferences;
create trigger update_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- Permisos y Grants
-- ============================================================================

grant select, insert, update, delete on table public.push_devices to authenticated;
grant select, insert, update, delete on table public.notification_preferences to authenticated;

-- Direct authenticated UPDATE strictly limited to read_at; insert/delete denied
revoke all on table public.notifications from authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

grant all on table public.push_devices to service_role;
grant all on table public.notification_preferences to service_role;
grant all on table public.notifications to service_role;

revoke all on table public.push_devices from anon, public;
revoke all on table public.notification_preferences from anon, public;
revoke all on table public.notifications from anon, public;
