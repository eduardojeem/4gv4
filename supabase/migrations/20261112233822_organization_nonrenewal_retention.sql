begin;
-- Only lifecycle metadata. No organization, user or financial record is deleted.
create table public.organization_nonrenewal_cycles (
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 expired_at timestamptz not null,
 notified_at timestamptz not null default now(),
 provider_message_id text not null check(length(provider_message_id)>0),
 archive_due_at timestamptz not null,
 deletion_due_at timestamptz not null,
 archived_at timestamptz,
 resolved_at timestamptz,
 prior_storefront_public boolean,
 prior_marketplace_public boolean,
 archive_warning_sent_at timestamptz,
 deletion_warning_sent_at timestamptz,
 check(archive_due_at >= notified_at + interval '90 days'),
 check(deletion_due_at >= notified_at + interval '180 days'),
 check(deletion_due_at >= expired_at + interval '180 days')
);
alter table public.organization_nonrenewal_cycles enable row level security;
revoke all on public.organization_nonrenewal_cycles from public, anon, authenticated;
grant select,insert,update on public.organization_nonrenewal_cycles to service_role;

-- The subscription row lock serializes registration/archive with renewal updates.
create function public.register_nonrenewal_notice(p_organization_id uuid,p_expired_at timestamptz,p_provider_message_id text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare s public.subscriptions%rowtype; e timestamptz; c public.organization_nonrenewal_cycles%rowtype;
begin
 select * into s from public.subscriptions where organization_id=p_organization_id for update;
 if not found then return false; end if;
 e := case when s.status='trialing' then s.trial_ends_at else coalesce(s.current_period_ends_at,s.trial_ends_at) end;
 if e is null or e>now() or e is distinct from p_expired_at then return false; end if;
 if not (s.status in ('suspended','cancelled','canceled','past_due','expired','unpaid') or s.payment_status='unpaid' or s.status in ('active','trialing')) then return false; end if;
 select * into c from public.organization_nonrenewal_cycles where organization_id=p_organization_id for update;
 if found and c.expired_at=e and c.resolved_at is null then return false; end if;
 -- A resolved notification cannot be reused by a later unpaid period.
 insert into public.organization_nonrenewal_cycles(organization_id,expired_at,notified_at,provider_message_id,archive_due_at,deletion_due_at)
 values(p_organization_id,e,now(),p_provider_message_id,now()+interval '90 days',now()+interval '180 days')
 on conflict(organization_id) do update set expired_at=e,notified_at=now(),provider_message_id=p_provider_message_id,
 archive_due_at=now()+interval '90 days',deletion_due_at=now()+interval '180 days',archived_at=null,resolved_at=null,
 prior_storefront_public=null,prior_marketplace_public=null,archive_warning_sent_at=null,deletion_warning_sent_at=null;
 return true;
end $$;

create function public.advance_nonrenewal_cycle(p_organization_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare s public.subscriptions%rowtype; c public.organization_nonrenewal_cycles%rowtype; e timestamptz;
begin
 select * into s from public.subscriptions where organization_id=p_organization_id for update;
 if not found then return 'missing'; end if;
 select * into c from public.organization_nonrenewal_cycles where organization_id=p_organization_id for update;
 if not found or c.resolved_at is not null then return 'inactive'; end if;
 e := case when s.status='trialing' then s.trial_ends_at else coalesce(s.current_period_ends_at,s.trial_ends_at) end;
 if e is distinct from c.expired_at or (s.status='active' and (s.current_period_ends_at>now() or (s.current_period_ends_at is null and s.payment_status='paid'))) then
  update public.organization_nonrenewal_cycles set resolved_at=now() where organization_id=p_organization_id;
  -- Publication stays off: renewal must never publish a private shop automatically.
  return 'resolved';
 end if;
 if now()>=c.archive_due_at and c.archived_at is null then
  select storefront_public,marketplace_public into c.prior_storefront_public,c.prior_marketplace_public from public.organizations where id=p_organization_id for update;
  update public.organization_nonrenewal_cycles set archived_at=now(),prior_storefront_public=c.prior_storefront_public,prior_marketplace_public=c.prior_marketplace_public where organization_id=p_organization_id;
  update public.organizations set storefront_public=false,marketplace_public=false where id=p_organization_id;
 end if;
 if now()>=c.deletion_due_at then return 'pending_deletion_review'; end if;
 return case when now()>=c.archive_due_at then 'archived' else 'suspended' end;
end $$;

-- Cancel the old cycle immediately at renewal, rather than waiting for the daily cron.
create function public.resolve_nonrenewal_on_renewal() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='active' and (new.current_period_ends_at>now() or (new.current_period_ends_at is null and new.payment_status='paid')) then
  update public.organization_nonrenewal_cycles set resolved_at=now() where organization_id=new.organization_id and resolved_at is null;
 end if;
 return new;
end $$;
create trigger resolve_nonrenewal_on_renewal after update of status,current_period_ends_at,payment_status on public.subscriptions
 for each row execute function public.resolve_nonrenewal_on_renewal();

-- Prevent republishing an archived organization through another settings endpoint.
create function public.prevent_archived_organization_publication() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if (new.storefront_public or new.marketplace_public) and exists(select 1 from public.organization_nonrenewal_cycles where organization_id=new.id and archived_at is not null and resolved_at is null) then
  raise exception 'La empresa está archivada. Renová antes de volver a publicarla.';
 end if;
 return new;
end $$;
create trigger prevent_archived_organization_publication before update of storefront_public,marketplace_public on public.organizations
 for each row execute function public.prevent_archived_organization_publication();
revoke all on function public.register_nonrenewal_notice(uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.advance_nonrenewal_cycle(uuid) from public,anon,authenticated;
revoke all on function public.resolve_nonrenewal_on_renewal() from public,anon,authenticated;
revoke all on function public.prevent_archived_organization_publication() from public,anon,authenticated;
grant execute on function public.register_nonrenewal_notice(uuid,timestamptz,text) to service_role;
grant execute on function public.advance_nonrenewal_cycle(uuid) to service_role;
commit;