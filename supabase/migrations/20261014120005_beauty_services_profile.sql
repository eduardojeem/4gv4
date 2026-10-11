begin;

alter table public.organizations
  add column if not exists service_specialties text[] not null default '{}',
  add column if not exists attention_mode text not null default 'local',
  add column if not exists appointment_mode text not null default 'booking';

create or replace function public.valid_service_specialties(items text[])
returns boolean language sql immutable strict set search_path = '' as $$
  select cardinality(items) <= 8
    and items <@ array['barbering','hair','nails','lashes','brows','makeup','aesthetics','other']::text[]
    and array_position(items, null) is null
    and cardinality(items) = (select count(distinct value) from unnest(items) as value);
$$;

alter table public.organizations drop constraint if exists organizations_business_vertical_check;
alter table public.organizations add constraint organizations_business_vertical_check check (
  business_vertical = any(array['general','clothing','cosmetics','electronics','food','hardware','barbershop','beauty_services','other']::text[])
);
alter table public.organizations drop constraint if exists organizations_service_specialties_check;
alter table public.organizations add constraint organizations_service_specialties_check
  check (public.valid_service_specialties(service_specialties));
alter table public.organizations drop constraint if exists organizations_attention_mode_check;
alter table public.organizations add constraint organizations_attention_mode_check
  check (attention_mode in ('local','home','both'));
alter table public.organizations drop constraint if exists organizations_appointment_mode_check;
alter table public.organizations add constraint organizations_appointment_mode_check
  check (appointment_mode in ('booking','walk_in','both'));

alter table public.global_categories drop constraint if exists global_categories_verticals_check;
alter table public.global_categories add constraint global_categories_verticals_check check (
  verticals <@ array['general','clothing','cosmetics','electronics','food','hardware','barbershop','beauty_services','other']::text[]
);

commit;
