alter table public.repairs
  add column if not exists creation_completed_at timestamptz;

comment on column public.repairs.creation_completed_at is
  'Set only after all related repair rows and inventory synchronization finish; idempotent retries replay completed rows only.';

update public.repairs
set creation_completed_at = coalesce(created_at, now())
where creation_idempotency_key is not null
  and creation_completed_at is null;

create index if not exists repairs_creation_in_progress_idx
  on public.repairs (organization_id, creation_idempotency_key)
  where creation_idempotency_key is not null
    and creation_completed_at is null;
