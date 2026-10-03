-- Qué servicios hace cada profesional.
--
-- Sin esto la reserva online ofrecía a cualquiera para cualquier servicio: a
-- la colorista se le podía reservar un perfilado de barba. Un profesional SIN
-- filas hace todos los servicios (así quedan las agendas existentes); con
-- filas, solo los listados.

begin;

create table if not exists public.agenda_professional_services (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.agenda_professionals(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (professional_id, product_id)
);
create index if not exists agenda_professional_services_org_idx
  on public.agenda_professional_services (organization_id);

alter table public.agenda_professional_services enable row level security;

drop policy if exists agenda_professional_services_read on public.agenda_professional_services;
create policy agenda_professional_services_read on public.agenda_professional_services for select to authenticated
  using (public.get_org_role(organization_id) is not null);

drop policy if exists agenda_professional_services_write on public.agenda_professional_services;
create policy agenda_professional_services_write on public.agenda_professional_services for all to authenticated
  using (public.has_org_permission(organization_id, 'settings.manage'))
  with check (
    public.has_org_permission(organization_id, 'settings.manage')
    and exists (
      select 1 from public.agenda_professionals p
      where p.id = professional_id and p.organization_id = agenda_professional_services.organization_id
    )
    and exists (
      select 1 from public.products pr
      where pr.id = product_id and pr.organization_id = agenda_professional_services.organization_id
    )
  );

commit;
