-- Contacto alternativo del cliente.
--
-- En un taller el telefono del cliente suele ser el equipo que dejo a reparar:
-- llamarlo a ese numero no sirve justamente cuando hay algo que avisarle. Por eso
-- se guarda un segundo contacto —de un familiar, del trabajo, de quien sea— junto
-- con la aclaracion de quien atiende, para que quien llame sepa con quien habla.

begin;

alter table public.customers
  add column if not exists alternate_phone text,
  add column if not exists alternate_phone_label text;

comment on column public.customers.alternate_phone is
  'Telefono alternativo para avisar al cliente cuando su propio equipo esta en el taller.';
comment on column public.customers.alternate_phone_label is
  'De quien es el telefono alternativo: hermana, jefe, hijo, trabajo, etc.';

-- Buscar por el alternativo tambien: el cliente puede llamar desde ese numero.
create index if not exists idx_customers_alternate_phone
  on public.customers (organization_id, alternate_phone)
  where alternate_phone is not null;

commit;
