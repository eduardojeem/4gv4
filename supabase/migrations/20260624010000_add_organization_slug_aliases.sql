create table if not exists public.organization_slug_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  old_slug text not null,
  new_slug text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint organization_slug_aliases_old_slug_unique unique (old_slug),
  constraint organization_slug_aliases_old_slug_format check (old_slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  constraint organization_slug_aliases_new_slug_format check (new_slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  constraint organization_slug_aliases_not_self check (old_slug <> new_slug)
);

create index if not exists organization_slug_aliases_organization_id_idx
  on public.organization_slug_aliases (organization_id);

alter table public.organization_slug_aliases enable row level security;

drop policy if exists "Public can read organization slug aliases" on public.organization_slug_aliases;
create policy "Public can read organization slug aliases"
  on public.organization_slug_aliases
  for select
  to anon, authenticated
  using (true);

grant select on public.organization_slug_aliases to anon, authenticated;
