-- Scope authorized pickup persons by organization when used from tenant public profiles.

alter table public.authorized_persons
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_authorized_persons_org_profile
on public.authorized_persons(organization_id, profile_id);
