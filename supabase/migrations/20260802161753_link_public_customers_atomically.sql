-- Keep one customer row per auth profile and organization. The June 7 migration
-- accidentally restored the legacy global profile_id uniqueness.
drop index if exists public.idx_customers_profile_id;
drop index if exists public.idx_customers_org_profile_id;

create unique index idx_customers_org_profile_id
on public.customers(organization_id, profile_id)
where organization_id is not null and profile_id is not null;

create index if not exists idx_customers_profile_id_lookup
on public.customers(profile_id)
where profile_id is not null;

-- Auth signup creates the global profile only. A customer row belongs to a
-- concrete organization and is created by link_public_customer_account().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name_val text;
begin
  full_name_val := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuario'
  );

  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, full_name_val, 'cliente', 'active')
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
      updated_at = now();

  return new;
exception when others then
  raise warning '[handle_new_user] Profile synchronization failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$;

create or replace function public.link_public_customer_account(
  p_organization_id uuid,
  p_profile_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_customer_id uuid default null
)
returns table(customer_id uuid, membership_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_customer_id uuid;
  resolved_membership_role text;
  normalized_name text := coalesce(nullif(trim(p_full_name), ''), 'Cliente');
  normalized_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  normalized_phone text := nullif(trim(coalesce(p_phone, '')), '');
  first_name_val text;
  last_name_val text;
begin
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  if not exists (select 1 from auth.users where id = p_profile_id) then
    raise exception 'PROFILE_AUTH_USER_NOT_FOUND';
  end if;

  first_name_val := split_part(normalized_name, ' ', 1);
  last_name_val := coalesce(nullif(trim(substring(normalized_name from position(' ' in normalized_name) + 1)), ''), '');

  insert into public.profiles (id, email, full_name, role, status)
  values (p_profile_id, normalized_email, normalized_name, 'cliente', 'active')
  on conflict (id) do update
  set email = coalesce(excluded.email, profiles.email),
      full_name = excluded.full_name,
      status = 'active',
      updated_at = now();

  if p_customer_id is not null then
    select c.id into resolved_customer_id
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = p_organization_id
      and (c.profile_id is null or c.profile_id = p_profile_id);
  end if;

  if resolved_customer_id is null then
    select c.id into resolved_customer_id
    from public.customers c
    where c.organization_id = p_organization_id
      and c.profile_id = p_profile_id
    order by c.updated_at desc nulls last, c.created_at desc
    limit 1;
  end if;

  if resolved_customer_id is null and normalized_email is not null then
    select c.id into resolved_customer_id
    from public.customers c
    where c.organization_id = p_organization_id
      and lower(c.email) = normalized_email
      and c.profile_id is null
    order by c.updated_at desc nulls last, c.created_at desc
    limit 1;
  end if;

  if resolved_customer_id is null and normalized_phone is not null then
    select c.id into resolved_customer_id
    from public.customers c
    where c.organization_id = p_organization_id
      and c.phone = normalized_phone
      and c.profile_id is null
    order by c.updated_at desc nulls last, c.created_at desc
    limit 1;
  end if;

  if resolved_customer_id is null then
    insert into public.customers (
      organization_id, profile_id, name, first_name, last_name, email, phone,
      customer_type, segment, status, created_at, updated_at
    ) values (
      p_organization_id, p_profile_id, normalized_name, first_name_val,
      last_name_val, normalized_email, coalesce(normalized_phone, ''),
      'regular', 'new', 'active', now(), now()
    )
    returning id into resolved_customer_id;
  else
    update public.customers
    set profile_id = p_profile_id,
        name = normalized_name,
        first_name = first_name_val,
        last_name = last_name_val,
        email = coalesce(normalized_email, email),
        phone = coalesce(normalized_phone, phone, ''),
        status = 'active',
        updated_at = now()
    where id = resolved_customer_id
      and organization_id = p_organization_id;
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_organization_id, p_profile_id, 'customer', 'active')
  on conflict (organization_id, user_id) do update
  set status = case
        when organization_members.role = 'customer' then 'active'
        else organization_members.status
      end,
      updated_at = now();

  select om.role::text into resolved_membership_role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = p_profile_id;

  return query select resolved_customer_id, resolved_membership_role;
end;
$$;

revoke all on function public.link_public_customer_account(uuid, uuid, text, text, text, uuid) from public;
revoke all on function public.link_public_customer_account(uuid, uuid, text, text, text, uuid) from anon;
revoke all on function public.link_public_customer_account(uuid, uuid, text, text, text, uuid) from authenticated;
grant execute on function public.link_public_customer_account(uuid, uuid, text, text, text, uuid) to service_role;

-- Logged-in public orders create the order, reserve stock and link the buyer in
-- the same transaction. Any linking error rolls back the complete checkout.
create or replace function public.create_public_order_with_customer_account_atomic(
  p_organization_id uuid,
  p_customer_id uuid,
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb,
  p_promotion_id uuid,
  p_profile_id uuid,
  p_profile_name text,
  p_profile_email text,
  p_profile_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order jsonb;
  created_customer_id uuid;
begin
  created_order := public.create_public_order_atomic(
    p_organization_id,
    p_customer_id,
    p_customer,
    p_order,
    p_items,
    p_promotion_id
  );

  if p_profile_id is not null then
    created_customer_id := nullif(created_order->>'customer_id', '')::uuid;

    perform public.link_public_customer_account(
      p_organization_id,
      p_profile_id,
      coalesce(nullif(trim(p_profile_name), ''), p_customer->>'name', 'Cliente'),
      coalesce(nullif(trim(p_profile_email), ''), p_customer->>'email'),
      coalesce(nullif(trim(p_profile_phone), ''), p_customer->>'phone'),
      created_customer_id
    );
  end if;

  return created_order;
end;
$$;

revoke all on function public.create_public_order_with_customer_account_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text) from public;
revoke all on function public.create_public_order_with_customer_account_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text) from anon;
revoke all on function public.create_public_order_with_customer_account_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.create_public_order_with_customer_account_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text) to service_role;

-- Repair customer memberships created without their commercial customer row.
do $$
declare
  account record;
begin
  for account in
    select om.organization_id, om.user_id, p.full_name, p.email, p.phone
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.role = 'customer'
      and om.status = 'active'
      and not exists (
        select 1 from public.customers c
        where c.organization_id = om.organization_id
          and c.profile_id = om.user_id
      )
  loop
    perform public.link_public_customer_account(
      account.organization_id,
      account.user_id,
      coalesce(nullif(trim(account.full_name), ''), nullif(split_part(coalesce(account.email, ''), '@', 1), ''), 'Cliente'),
      account.email,
      account.phone,
      null
    );
  end loop;
end;
$$;

-- Add the missing customer membership without replacing an existing staff role.
insert into public.organization_members (organization_id, user_id, role, status)
select c.organization_id, c.profile_id, 'customer', 'active'
from public.customers c
where c.organization_id is not null
  and c.profile_id is not null
  and not exists (
    select 1 from public.organization_members om
    where om.organization_id = c.organization_id
      and om.user_id = c.profile_id
  )
on conflict (organization_id, user_id) do nothing;
