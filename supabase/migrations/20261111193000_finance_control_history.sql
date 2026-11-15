-- Prepared only: do not apply to a remote database without authorization.
begin;
create table public.finance_control_events (
 id uuid primary key default gen_random_uuid(),
 sequence bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id),
 branch_id uuid references public.branches(id),
 scope_key text generated always as (coalesce(branch_id::text, 'all')) stored,
 actor_id uuid not null references public.profiles(id),
 kind text not null check (kind in ('config','closure')),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 period_start date,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 50000),
 idempotency_key text not null check (length(idempotency_key) between 8 and 160),
 created_at timestamptz not null default now(),
 unique (organization_id,idempotency_key),
 check ((kind='config' and period_start is null) or (kind='closure' and period_start is not null and extract(day from period_start)=1))
);
create index finance_control_events_scope on public.finance_control_events(organization_id,scope_key,currency,kind,sequence desc);
alter table public.finance_control_events enable row level security;
revoke all on public.finance_control_events from public,anon,authenticated,service_role;
grant select on public.finance_control_events to service_role;

create function public.append_finance_control_event(
 p_organization_id uuid,p_branch_id uuid,p_actor_id uuid,p_kind text,p_currency text,
 p_period_start date,p_payload jsonb,p_idempotency_key text,p_expected_version bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.finance_control_events; saved public.finance_control_events; current_version bigint;
begin
 if p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and organization_id=p_organization_id) then raise exception 'FINANCE_CONTROL_BRANCH_MISMATCH'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':'||coalesce(p_branch_id::text,'all')||':'||p_currency,0));
 select * into existing from public.finance_control_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
  if existing.branch_id is distinct from p_branch_id or existing.kind<>p_kind or existing.currency<>p_currency or existing.period_start is distinct from p_period_start or existing.payload<>p_payload or existing.actor_id<>p_actor_id then raise exception 'FINANCE_CONTROL_IDEMPOTENCY_CONFLICT'; end if;
  return to_jsonb(existing);
 end if;
 if p_kind='config' then
  select coalesce(max(sequence),0) into current_version from public.finance_control_events where organization_id=p_organization_id and scope_key=coalesce(p_branch_id::text,'all') and currency=p_currency and kind='config';
  if current_version<>p_expected_version then raise exception 'FINANCE_CONTROL_VERSION_CONFLICT'; end if;
 end if;
 insert into public.finance_control_events(organization_id,branch_id,actor_id,kind,currency,period_start,payload,idempotency_key)
 values(p_organization_id,p_branch_id,p_actor_id,p_kind,p_currency,p_period_start,p_payload,p_idempotency_key) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.append_finance_control_event(uuid,uuid,uuid,text,text,date,jsonb,text,bigint) from public,anon,authenticated;
grant execute on function public.append_finance_control_event(uuid,uuid,uuid,text,text,date,jsonb,text,bigint) to service_role;
comment on table public.finance_control_events is 'Immutable settings revisions and informational monthly snapshots. Does not freeze operational transactions.';
commit;
