-- Comentarios que mandan los usuarios desde «Enviar comentarios» (web y app):
-- errores, ideas o algo que funciona bien. Solo el servidor escribe y lee.

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  kind text not null check (kind in ('bug', 'idea', 'praise')),
  message text not null check (char_length(message) between 3 and 2000),
  page_path text check (page_path is null or char_length(page_path) <= 300),
  source text not null default 'web' check (source in ('web', 'app')),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  status text not null default 'new' check (status in ('new', 'reviewed', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_created_at_idx on public.user_feedback (created_at desc);
create index if not exists user_feedback_user_created_idx on public.user_feedback (user_id, created_at desc);

-- Sin políticas: authenticated y anon no ven ni escriben; la API usa service_role.
alter table public.user_feedback enable row level security;
revoke all on table public.user_feedback from anon, authenticated;
