-- Support sessions: time-boxed, audited "support mode" for platform super_admins.
--
-- A super_admin must explicitly open a support session (with a reason) against a
-- specific organization before operating on that tenant. Sessions expire, can be
-- ended manually, and every start/end is also written to audit_log by the app.
--
-- Access is via the service-role (admin) client only; RLS denies everyone else.

create table if not exists public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  super_admin_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reason text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.support_sessions is
  'Time-boxed support-mode sessions for platform super_admins operating on a tenant.';

create index if not exists idx_support_sessions_super_admin
  on public.support_sessions (super_admin_id);

create index if not exists idx_support_sessions_organization
  on public.support_sessions (organization_id);

-- Fast lookup of currently-active sessions (not ended).
create index if not exists idx_support_sessions_active
  on public.support_sessions (super_admin_id, expires_at)
  where ended_at is null;

alter table public.support_sessions enable row level security;

-- No policies: only the service-role key (which bypasses RLS) may read/write.
-- This keeps support-session data out of reach of normal authenticated clients.
