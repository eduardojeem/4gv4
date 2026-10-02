-- Agenda de turnos para negocios de servicios (peluquerías, talleres,
-- consultorios, estéticas...).
--
--  * agenda_settings: horario de atención, largo del turno y reserva online.
--  * agenda_professionals: quién atiende. Sin profesionales cargados, la
--    agenda es una sola (un turno a la vez).
--  * agenda_services: cuánto dura cada servicio del catálogo (productos con
--    unidad «servicio») y si se reserva online.
--  * appointments: los turnos. Un trigger impide dos turnos superpuestos para
--    el mismo profesional, también cuando dos personas reservan a la vez.

begin;

create table if not exists public.agenda_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  slot_minutes integer not null default 30 check (slot_minutes in (10, 15, 20, 30, 45, 60)),
  -- Día de la semana (0 = domingo) → tramos [["08:00","12:00"],["14:00","19:00"]].
  opening_hours jsonb not null default '{"1":[["08:00","18:00"]],"2":[["08:00","18:00"]],"3":[["08:00","18:00"]],"4":[["08:00","18:00"]],"5":[["08:00","18:00"]],"6":[["08:00","12:00"]]}'::jsonb,
  online_booking boolean not null default false,
  require_confirmation boolean not null default true,
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 10080),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 180),
  booking_message text check (booking_message is null or char_length(booking_message) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  phone text check (phone is null or char_length(phone) <= 40),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists agenda_professionals_org_idx on public.agenda_professionals (organization_id, sort_order);

create table if not exists public.agenda_services (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 600),
  online boolean not null default true,
  primary key (organization_id, product_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number integer not null,
  professional_id uuid references public.agenda_professionals(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 160),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 40),
  service_product_id uuid references public.products(id) on delete set null,
  service_name text not null check (char_length(trim(service_name)) between 1 and 200),
  price numeric(14,2) not null default 0 check (price >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source text not null default 'dashboard' check (source in ('dashboard', 'online')),
  notes text check (notes is null or char_length(notes) <= 1000),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  public_token uuid not null default gen_random_uuid() unique,
  sale_id uuid references public.sales(id) on delete set null,
  confirmed_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours')
);
create index if not exists appointments_org_starts_idx on public.appointments (organization_id, starts_at);
create index if not exists appointments_professional_idx on public.appointments (professional_id, starts_at) where professional_id is not null;

drop trigger if exists appointments_assign_number on public.appointments;
create trigger appointments_assign_number before insert on public.appointments
  for each row execute function public.assign_document_number();
drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at before update on public.appointments
  for each row execute function public.touch_document_updated_at();

-- Nada de dos turnos a la vez para el mismo profesional (o para la agenda
-- única, si la empresa no cargó profesionales). El candado serializa a dos
-- clientes que reservan el mismo horario al mismo tiempo.
create or replace function public.check_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'appointment:' || new.organization_id::text || ':' || coalesce(new.professional_id::text, 'agenda'), 0));
  if exists (
    select 1 from public.appointments other
    where other.organization_id = new.organization_id
      and other.professional_id is not distinct from new.professional_id
      and other.id <> new.id
      and other.status in ('pending', 'confirmed')
      and tstzrange(other.starts_at, other.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) then
    raise exception 'APPOINTMENT_OVERLAP';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_no_overlap on public.appointments;
create trigger appointments_no_overlap before insert or update of starts_at, ends_at, professional_id, status on public.appointments
  for each row execute function public.check_appointment_overlap();

-- ── Permisos ─────────────────────────────────────────────────────────────
-- Cualquier persona del equipo ve y carga turnos; la configuración, dueño o
-- administrador. La reserva online la hace el servidor (service role).

alter table public.agenda_settings enable row level security;
alter table public.agenda_professionals enable row level security;
alter table public.agenda_services enable row level security;
alter table public.appointments enable row level security;

drop policy if exists agenda_settings_read on public.agenda_settings;
create policy agenda_settings_read on public.agenda_settings for select to authenticated
  using (public.get_org_role(organization_id) is not null);
drop policy if exists agenda_settings_write on public.agenda_settings;
create policy agenda_settings_write on public.agenda_settings for all to authenticated
  using (public.has_org_permission(organization_id, 'settings.manage'))
  with check (public.has_org_permission(organization_id, 'settings.manage'));

drop policy if exists agenda_professionals_read on public.agenda_professionals;
create policy agenda_professionals_read on public.agenda_professionals for select to authenticated
  using (public.get_org_role(organization_id) is not null);
drop policy if exists agenda_professionals_write on public.agenda_professionals;
create policy agenda_professionals_write on public.agenda_professionals for all to authenticated
  using (public.has_org_permission(organization_id, 'settings.manage'))
  with check (public.has_org_permission(organization_id, 'settings.manage'));

drop policy if exists agenda_services_read on public.agenda_services;
create policy agenda_services_read on public.agenda_services for select to authenticated
  using (public.get_org_role(organization_id) is not null);
drop policy if exists agenda_services_write on public.agenda_services;
create policy agenda_services_write on public.agenda_services for all to authenticated
  using (public.has_org_permission(organization_id, 'settings.manage'))
  with check (
    public.has_org_permission(organization_id, 'settings.manage')
    and exists (select 1 from public.products p where p.id = product_id and p.organization_id = agenda_services.organization_id)
  );

drop policy if exists appointments_staff_read on public.appointments;
create policy appointments_staff_read on public.appointments for select to authenticated
  using (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer');
drop policy if exists appointments_staff_insert on public.appointments;
create policy appointments_staff_insert on public.appointments for insert to authenticated
  with check (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer');
drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments for update to authenticated
  using (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer')
  with check (coalesce(public.get_org_role(organization_id)::text, 'customer') <> 'customer');

commit;
