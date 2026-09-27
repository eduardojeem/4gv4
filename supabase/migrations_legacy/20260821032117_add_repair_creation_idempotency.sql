alter table public.repairs
  add column if not exists creation_idempotency_key text,
  add column if not exists creation_payload_hash text;

alter table public.repairs
  drop constraint if exists repairs_creation_idempotency_consistency;

alter table public.repairs
  add constraint repairs_creation_idempotency_consistency
  check (
    (creation_idempotency_key is null and creation_payload_hash is null)
    or (
      creation_idempotency_key is not null
      and creation_payload_hash is not null
      and char_length(trim(creation_idempotency_key)) between 8 and 120
      and creation_payload_hash ~ '^[0-9a-f]{64}$'
    )
  );

create unique index if not exists repairs_creation_idempotency_org_key
  on public.repairs (organization_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

comment on column public.repairs.creation_idempotency_key is
  'Client-generated key that makes repair creation safe to retry.';

comment on column public.repairs.creation_payload_hash is
  'SHA-256 fingerprint used to reject reuse of a creation key with changed data.';
