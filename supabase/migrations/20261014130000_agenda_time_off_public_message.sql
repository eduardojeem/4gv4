-- Aviso público de una ausencia: lo que ve el cliente en la página web
-- («Cerrado por vacaciones»). Separado de `reason`, que es interno y puede
-- decir cosas que no se publican. Null = no se muestra.
alter table public.agenda_time_off
  add column if not exists public_message text
  check (public_message is null or char_length(public_message) between 3 and 160);

comment on column public.agenda_time_off.public_message is
  'Texto que la página web muestra durante el cierre. Solo en cierres de toda la tienda (professional_id null).';

-- Solo los cierres de toda la tienda se publican: la ausencia de un profesional
-- es interna (su agenda ya no ofrece esos horarios).
alter table public.agenda_time_off
  drop constraint if exists agenda_time_off_public_message_store_only;
alter table public.agenda_time_off
  add constraint agenda_time_off_public_message_store_only
  check (public_message is null or professional_id is null);
