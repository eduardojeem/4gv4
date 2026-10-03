-- Novedades de turnos que hace el cliente: reserva online, cambio de horario
-- y cancelación desde «Mi turno».
--
-- Antes el turno cambiaba en la agenda sin que nadie se enterara: la tienda
-- veía el horario nuevo (o el hueco) recién al mirar la agenda. Cada novedad
-- queda registrada y se muestra en la campanita de la Agenda hasta que alguien
-- del equipo la marca como vista. Además se puede avisar por email.

begin;

create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('booked', 'rescheduled', 'cancelled')),
  customer_name text not null check (char_length(customer_name) <= 160),
  service_name text not null check (char_length(service_name) <= 200),
  starts_at timestamptz not null,
  previous_starts_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists appointment_events_org_created_idx
  on public.appointment_events (organization_id, created_at desc);
create index if not exists appointment_events_org_unseen_idx
  on public.appointment_events (organization_id) where seen_at is null;

-- Avisar por email al contacto de la tienda (se puede apagar).
alter table public.agenda_settings
  add column if not exists notify_email boolean not null default true;

-- El equipo las ve y las marca como vistas; las crea el servidor (service role).
alter table public.appointment_events enable row level security;

drop policy if exists appointment_events_staff_read on public.appointment_events;
create policy appointment_events_staff_read on public.appointment_events for select to authenticated
  using (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer');

drop policy if exists appointment_events_staff_seen on public.appointment_events;
create policy appointment_events_staff_seen on public.appointment_events for update to authenticated
  using (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer')
  with check (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer');

-- Lo único que el equipo puede cambiar es «visto».
revoke insert, update, delete on public.appointment_events from anon, authenticated;
grant select on public.appointment_events to authenticated;
grant update (seen_at) on public.appointment_events to authenticated;

commit;
