-- Harden platform administration operations that must not be partially applied.

insert into public.user_roles (user_id, role, is_active, updated_at)
select profiles.id, 'super_admin', true, now()
  from public.profiles profiles
 where profiles.role = 'super_admin'
   and not exists (
     select 1
       from public.user_roles roles
      where roles.user_id = profiles.id
   );

create or replace function public.set_super_admin_role(
  p_target_user_id uuid,
  p_email text,
  p_grant boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_active_super_admins integer;
begin
  perform pg_advisory_xact_lock(hashtext('super_admin_role_changes'));

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role, is_active, updated_at)
    values (p_target_user_id, 'super_admin', true, now())
    on conflict (user_id) do update
      set role = excluded.role,
          is_active = true,
          updated_at = now();

    insert into public.profiles (id, email, role, status)
    values (p_target_user_id, nullif(lower(trim(p_email)), ''), 'super_admin', 'active')
    on conflict (id) do update
      set email = coalesce(excluded.email, public.profiles.email),
          role = 'super_admin',
          status = 'active';

    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', 'super_admin')
     where id = p_target_user_id;
    return;
  end if;

  select count(*)
    into v_active_super_admins
    from public.user_roles
   where role = 'super_admin'
     and is_active = true;

  if v_active_super_admins <= 1 then
    raise exception 'LAST_SUPER_ADMIN';
  end if;

  update public.user_roles
     set role = 'admin',
         is_active = true,
         updated_at = now()
   where user_id = p_target_user_id
     and role = 'super_admin';

  if not found then
    raise exception 'SUPER_ADMIN_NOT_FOUND';
  end if;

  update public.profiles
     set role = 'admin'
   where id = p_target_user_id;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('role', 'admin')
   where id = p_target_user_id;
end;
$$;

revoke all on function public.set_super_admin_role(uuid, text, boolean) from public;
grant execute on function public.set_super_admin_role(uuid, text, boolean) to service_role;

create or replace function public.create_superadmin_organization(
  p_name text,
  p_slug text,
  p_plan text,
  p_currency text,
  p_timezone text,
  p_trial_ends_at timestamptz
)
returns setof public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization public.organizations%rowtype;
begin
  insert into public.organizations (name, slug, plan)
  values (p_name, p_slug, p_plan)
  returning * into v_organization;

  insert into public.organization_settings (
    organization_id, display_name, currency, timezone, branding, modules
  )
  values (
    v_organization.id,
    p_name,
    p_currency,
    p_timezone,
    '{}'::jsonb,
    jsonb_build_object(
      'onboarding',
      jsonb_build_object(
        'status', 'pending',
        'selected_plan', p_plan,
        'started_at', now()
      )
    )
  );

  insert into public.branches (
    organization_id, code, name, slug, is_active, is_default
  )
  values (
    v_organization.id, 'principal', 'Sucursal principal', 'principal', true, true
  );

  insert into public.subscriptions (
    organization_id, plan, status, trial_ends_at, cancel_at_period_end
  )
  values (
    v_organization.id, p_plan, 'trialing', p_trial_ends_at, false
  );

  return next v_organization;
end;
$$;

revoke all on function public.create_superadmin_organization(text, text, text, text, text, timestamptz) from public;
grant execute on function public.create_superadmin_organization(text, text, text, text, text, timestamptz) to service_role;

create or replace function public.assign_superadmin_organization_owner(
  p_organization_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.organizations where id = p_organization_id for update) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.profiles (id, email, full_name, role, status)
  values (p_user_id, lower(trim(p_email)), nullif(trim(p_full_name), ''), 'admin', 'active')
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = 'admin',
        status = 'active';

  insert into public.user_roles (user_id, role, is_active, updated_at)
  values (p_user_id, 'admin', true, now())
  on conflict (user_id) do update
    set role = 'admin',
        is_active = true,
        updated_at = now();

  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_organization_id, p_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do update
    set role = 'owner',
        status = 'active',
        updated_at = now();

  update public.organizations
     set owner_id = p_user_id,
         updated_at = now()
   where id = p_organization_id;
end;
$$;

revoke all on function public.assign_superadmin_organization_owner(uuid, uuid, text, text) from public;
grant execute on function public.assign_superadmin_organization_owner(uuid, uuid, text, text) to service_role;

create or replace function public.update_superadmin_subscription(
  p_subscription_id uuid,
  p_plan text,
  p_status text,
  p_trial_ends_at timestamptz,
  p_period_starts_at timestamptz,
  p_period_ends_at timestamptz,
  p_cancel_at_period_end boolean
)
returns setof public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
begin
  if not exists (
    select 1
      from public.subscription_plans
     where tier = lower(p_plan)
       and is_active = true
  ) then
    raise exception 'INVALID_PLAN';
  end if;

  select *
    into v_subscription
    from public.subscriptions
   where id = p_subscription_id
   for update;

  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;

  update public.subscriptions
     set plan = p_plan,
         status = p_status::public.subscription_status,
         trial_ends_at = p_trial_ends_at,
         current_period_starts_at = p_period_starts_at,
         current_period_ends_at = p_period_ends_at,
         cancel_at_period_end = p_cancel_at_period_end,
         updated_at = now()
   where id = p_subscription_id
   returning * into v_subscription;

  update public.organizations
     set plan = p_plan,
         updated_at = now()
   where id = v_subscription.organization_id;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  return next v_subscription;
end;
$$;

revoke all on function public.update_superadmin_subscription(uuid, text, text, timestamptz, timestamptz, timestamptz, boolean) from public;
grant execute on function public.update_superadmin_subscription(uuid, text, text, timestamptz, timestamptz, timestamptz, boolean) to service_role;

create or replace function public.normalize_popular_subscription_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_popular then
    update public.subscription_plans
       set is_popular = false,
           updated_at = now()
     where id <> new.id
       and is_popular = true;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_popular_subscription_plan on public.subscription_plans;
create trigger normalize_popular_subscription_plan
before insert or update of is_popular on public.subscription_plans
for each row execute function public.normalize_popular_subscription_plan();

-- Activation codes can be redeemed by multiple organizations. The redemption
-- id is the idempotency key; the shared promo code is not.
drop index if exists public.idx_subscription_payments_provider_reference;

with duplicate_activation_references as (
  select id,
         row_number() over (
           partition by external_reference
           order by created_at, id
         ) as occurrence
    from public.subscription_payments
   where provider = 'activation'
     and external_reference is not null
)
update public.subscription_payments payments
   set external_reference = payments.external_reference || ':' || payments.id::text
  from duplicate_activation_references duplicates
 where payments.id = duplicates.id
   and duplicates.occurrence > 1;

create unique index if not exists idx_subscription_payments_activation_reference_unique
  on public.subscription_payments(external_reference)
  where provider = 'activation' and external_reference is not null;

create or replace function public.dispatch_due_global_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.global_notifications
     set status = 'sent',
         sent_at = coalesce(sent_at, now()),
         updated_at = now()
   where status = 'scheduled'
     and scheduled_at is not null
     and scheduled_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.dispatch_due_global_notifications() from public;
grant execute on function public.dispatch_due_global_notifications() to service_role;

create index if not exists global_notifications_due_idx
  on public.global_notifications(scheduled_at)
  where status = 'scheduled';

create or replace function public.get_superadmin_org_usage_counts(
  p_organization_ids uuid[]
)
returns table (
  organization_id uuid,
  members_count bigint,
  products_count bigint,
  sales_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select requested.organization_id,
         (
           select count(*)
             from public.organization_members members
            where members.organization_id = requested.organization_id
              and members.status = 'active'
         ) as members_count,
         (
           select count(*)
             from public.products products
            where products.organization_id = requested.organization_id
              and products.is_active = true
         ) as products_count,
         (
           select count(*)
             from public.sales sales
            where sales.organization_id = requested.organization_id
         ) as sales_count
    from unnest(coalesce(p_organization_ids, array[]::uuid[])) as requested(organization_id);
$$;

revoke all on function public.get_superadmin_org_usage_counts(uuid[]) from public;
grant execute on function public.get_superadmin_org_usage_counts(uuid[]) to service_role;

do $$
begin
  create extension if not exists pg_cron with schema extensions;

  perform cron.schedule(
    'dispatch-due-global-notifications',
    '* * * * *',
    'select public.dispatch_due_global_notifications();'
  );
exception
  when others then
    raise warning 'pg_cron unavailable (%); dispatch_due_global_notifications remains callable by service_role.', sqlerrm;
end;
$$;
