-- Foto y especialidad de cada profesional.
--
-- En la tienda (plantilla «Servicios») el equipo se mostraba con una inicial
-- y un color. En una peluquería o barbería el cliente elige a la persona:
-- foto y especialidad («Barbero · fades», «Colorista»).

begin;

alter table public.agenda_professionals
  add column if not exists photo_url text,
  add column if not exists specialty text;

alter table public.agenda_professionals drop constraint if exists agenda_professionals_photo_url_check;
alter table public.agenda_professionals add constraint agenda_professionals_photo_url_check
  check (photo_url is null or char_length(photo_url) <= 500);

alter table public.agenda_professionals drop constraint if exists agenda_professionals_specialty_check;
alter table public.agenda_professionals add constraint agenda_professionals_specialty_check
  check (specialty is null or char_length(specialty) <= 80);

commit;
