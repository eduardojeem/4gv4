-- Un gasto común (no recurrente) se guardaba con un INSERT directo: cada clic en
-- «Guardar» creaba otro. El 13 y 14 de agosto una tienda terminó con el mismo
-- alquiler 7, 18 y 22 veces, creados con uno o dos segundos de diferencia.
-- El formulario ya manda una clave por envío; con esta columna el servidor la
-- guarda y un segundo envío con la misma clave devuelve el gasto ya creado.

alter table public.finance_obligations
  add column if not exists creation_idempotency_key text;

alter table public.finance_obligations
  drop constraint if exists finance_obligations_creation_idempotency_key_check;
alter table public.finance_obligations
  add constraint finance_obligations_creation_idempotency_key_check
  check (
    creation_idempotency_key is null
    or char_length(trim(creation_idempotency_key)) between 1 and 128
  );

create unique index if not exists finance_obligations_creation_idempotency_key_uidx
  on public.finance_obligations (organization_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

notify pgrst, 'reload schema';
