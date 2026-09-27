-- Recepción: los equipos que el cliente dejó en la misma visita.
--
-- El formulario ya acepta hasta diez equipos y crea una orden por cada uno, que
-- es el modelo correcto —cada equipo se repara, se cobra y se entrega por su
-- cuenta—. Lo que faltaba era registrar que llegaron juntos: después de guardar
-- quedaban tres reparaciones sueltas del mismo cliente, sin nada que las
-- relacione.
--
-- Con eso no se podía dar un comprobante único por la visita, ni entregar los
-- tres equipos de una, ni responder "¿qué dejó esta persona el martes?" sin ir
-- fecha por fecha.
--
-- Se elige una columna y no una tabla de recepciones a propósito: no hay ningún
-- dato propio de la visita más allá de agrupar. Una tabla obligaría a crear la
-- fila antes que las órdenes y a decidir qué pasa si esa creación falla a mitad
-- de camino; la columna hace que agrupar sea una consecuencia de guardar, no un
-- paso más que puede fallar.

begin;

alter table public.repairs
  add column if not exists reception_id uuid;

comment on column public.repairs.reception_id is
  'Agrupa las ordenes creadas en una misma recepcion. Null = el equipo vino solo.';

-- Se busca siempre dentro de una tienda: "los demas equipos de esta recepcion".
-- Parcial porque las ordenes de un solo equipo no se agrupan y son la mayoria.
create index if not exists idx_repairs_reception
  on public.repairs (organization_id, reception_id)
  where reception_id is not null;

commit;
