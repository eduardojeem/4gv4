-- Datos de un cliente que no se pueden repetir dentro de una misma empresa:
-- telefono, correo y RUC/CI.
--
-- El problema para detectarlo es el formato: el mismo numero esta cargado como
-- "0981-123 456", "(0981) 123456" y "0981123456", y el mismo RUC como
-- "80012345-6" y "800123456". Comparar el texto tal cual no encuentra nada, y
-- normalizar en cada consulta no puede usar indice.
--
-- Estas columnas guardan la version normalizada, calculada por la base, asi que
-- no hay forma de que se desincronicen de lo que se ve en pantalla.

begin;

alter table public.customers
  add column if not exists phone_digits text
    generated always as (
      nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
    ) stored,
  add column if not exists email_lower text
    generated always as (
      nullif(lower(btrim(coalesce(email, ''))), '')
    ) stored,
  add column if not exists ruc_digits text
    generated always as (
      nullif(regexp_replace(upper(coalesce(ruc, '')), '[^A-Z0-9]', '', 'g'), '')
    ) stored;

comment on column public.customers.phone_digits is
  'Telefono sin separadores, para detectar el mismo numero cargado con otro formato.';
comment on column public.customers.email_lower is
  'Correo en minusculas, para comparar sin importar mayusculas.';
comment on column public.customers.ruc_digits is
  'RUC/CI sin guiones ni espacios, para detectar el mismo documento con otro formato.';

-- Indices, no restricciones unicas: los datos que ya estan cargados pueden tener
-- duplicados, y una restriccion ahi haria fallar la migracion sin decir cuales.
-- La aplicacion los rechaza en el alta y en la edicion; la restriccion en la base
-- es el paso siguiente, despues de limpiar lo que ya existe. Para encontrarlos:
--
--   select organization_id, phone_digits, count(*), array_agg(name)
--   from public.customers
--   where phone_digits is not null
--   group by 1, 2 having count(*) > 1;
--
create index if not exists idx_customers_phone_digits
  on public.customers (organization_id, phone_digits)
  where phone_digits is not null;

create index if not exists idx_customers_email_lower
  on public.customers (organization_id, email_lower)
  where email_lower is not null;

create index if not exists idx_customers_ruc_digits
  on public.customers (organization_id, ruc_digits)
  where ruc_digits is not null;

commit;
