begin;

alter table public.repair_status_history enable row level security;

create policy "repair_status_history_insert_own_or_null"
on public.repair_status_history
for insert
to authenticated
with check (
  changed_by = auth.uid() OR changed_by IS NULL
);

create policy "repair_status_history_select_own_or_null"
on public.repair_status_history
for select
to authenticated
using (
  changed_by = auth.uid() OR changed_by IS NULL
);

commit;
