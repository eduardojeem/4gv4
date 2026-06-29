-- Estado de lectura/descarte por usuario de las notificaciones globales.
-- Aplicada y validada en Supabase dev (proyecto bznebbqusxfzajmolqfg).

create table if not exists public.global_notification_reads (
  notification_id uuid not null references public.global_notifications(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  read_at         timestamptz not null default now(),
  dismissed       boolean not null default false,
  primary key (notification_id, user_id)
);

create index if not exists global_notification_reads_user_idx
  on public.global_notification_reads using btree (user_id);

alter table public.global_notification_reads enable row level security;

-- Cada usuario gestiona únicamente sus propias marcas de lectura.
drop policy if exists own_reads_select on public.global_notification_reads;
create policy own_reads_select on public.global_notification_reads
  for select using (auth.uid() = user_id);

drop policy if exists own_reads_upsert on public.global_notification_reads;
create policy own_reads_upsert on public.global_notification_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists own_reads_update on public.global_notification_reads;
create policy own_reads_update on public.global_notification_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
