-- SaaS multi-tenant foundation.
-- Apply in a staging database first. This migration is intentionally additive.

create extension if not exists pgcrypto;

do $$ begin
  create type public.organization_role as enum (
    'owner',
    'admin',
    'manager',
    'cashier',
    'technician',
    'seller',
    'customer'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'FREE' check (plan in ('FREE', 'BASIC', 'PRO', 'ENTERPRISE')),
  logo_url text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'customer',
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.organization_role not null default 'seller',
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  display_name text,
  currency text not null default 'PYG',
  timezone text not null default 'America/Asuncion',
  branding jsonb not null default '{}'::jsonb,
  modules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  code text primary key check (code in ('FREE', 'BASIC', 'PRO', 'ENTERPRISE')),
  name text not null,
  limits jsonb not null,
  modules text[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans (code, name, limits, modules)
values
  ('FREE', 'Free', '{"users":2,"products":100,"branches":1,"storageMb":1024}'::jsonb, array['inventory','pos']),
  ('BASIC', 'Basic', '{"users":5,"products":1000,"branches":1,"storageMb":5120}'::jsonb, array['inventory','pos','repairs','crm']),
  ('PRO', 'Pro', '{"users":20,"products":10000,"branches":5,"storageMb":51200}'::jsonb, array['inventory','pos','repairs','crm','ecommerce','whatsapp','analytics']),
  ('ENTERPRISE', 'Enterprise', '{"users":null,"products":null,"branches":null,"storageMb":null}'::jsonb, array['inventory','pos','repairs','crm','ecommerce','delivery','whatsapp','analytics'])
on conflict (code) do update set
  name = excluded.name,
  limits = excluded.limits,
  modules = excluded.modules;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan text not null default 'FREE' check (plan in ('FREE', 'BASIC', 'PRO', 'ENTERPRISE')),
  status public.subscription_status not null default 'trialing',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_members_user_id on public.organization_members(user_id);
create index if not exists idx_organization_members_org_role on public.organization_members(organization_id, role);
create index if not exists idx_organization_invitations_org_email on public.organization_invitations(organization_id, email);
create index if not exists idx_tenant_audit_org_created on public.tenant_audit_log(organization_id, created_at desc);

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.get_org_role(target_organization_id uuid)
returns public.organization_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = target_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

create or replace function public.has_org_permission(target_organization_id uuid, permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  member_role public.organization_role;
begin
  member_role := public.get_org_role(target_organization_id);

  if member_role is null then
    return false;
  end if;

  if member_role = 'owner' then
    return true;
  end if;

  if member_role = 'admin' then
    return permission_name <> 'billing.manage';
  end if;

  if member_role = 'manager' then
    return permission_name = any(array[
      'inventory.products.read',
      'inventory.products.create',
      'inventory.products.update',
      'inventory.stock.manage',
      'pos.sales.read',
      'pos.sales.create',
      'pos.cash.manage',
      'repairs.orders.read',
      'repairs.orders.create',
      'repairs.orders.update',
      'repairs.orders.assign',
      'crm.customers.read',
      'crm.customers.manage',
      'analytics.read'
    ]);
  end if;

  if member_role = 'cashier' then
    return permission_name = any(array[
      'inventory.products.read',
      'pos.sales.read',
      'pos.sales.create',
      'pos.cash.manage',
      'crm.customers.read'
    ]);
  end if;

  if member_role = 'technician' then
    return permission_name = any(array[
      'inventory.products.read',
      'inventory.stock.manage',
      'repairs.orders.read',
      'repairs.orders.update'
    ]);
  end if;

  if member_role = 'seller' then
    return permission_name = any(array[
      'inventory.products.read',
      'pos.sales.read',
      'pos.sales.create',
      'crm.customers.read',
      'crm.customers.manage'
    ]);
  end if;

  return member_role = 'customer' and permission_name = 'repairs.orders.read';
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tenant_audit_log enable row level security;

drop policy if exists "members can read organizations" on public.organizations;
create policy "members can read organizations" on public.organizations
for select using (public.is_org_member(id));

drop policy if exists "owners can update organizations" on public.organizations;
create policy "owners can update organizations" on public.organizations
for update using (public.has_org_permission(id, 'organization.manage'))
with check (public.has_org_permission(id, 'organization.manage'));

drop policy if exists "members can read organization members" on public.organization_members;
create policy "members can read organization members" on public.organization_members
for select using (public.is_org_member(organization_id));

drop policy if exists "owners admins can manage members" on public.organization_members;
create policy "owners admins can manage members" on public.organization_members
for all using (public.has_org_permission(organization_id, 'users.manage'))
with check (public.has_org_permission(organization_id, 'users.manage'));

drop policy if exists "owners can read subscriptions" on public.subscriptions;
create policy "owners can read subscriptions" on public.subscriptions
for select using (public.has_org_permission(organization_id, 'billing.manage'));

drop policy if exists "members can read organization settings" on public.organization_settings;
create policy "members can read organization settings" on public.organization_settings
for select using (public.is_org_member(organization_id));

drop policy if exists "admins can update organization settings" on public.organization_settings;
create policy "admins can update organization settings" on public.organization_settings
for update using (public.has_org_permission(organization_id, 'settings.manage'))
with check (public.has_org_permission(organization_id, 'settings.manage'));

drop policy if exists "members can read tenant audit" on public.tenant_audit_log;
create policy "members can read tenant audit" on public.tenant_audit_log
for select using (public.has_org_permission(organization_id, 'settings.manage'));

-- Default tenant for existing mono-tenant data. Replace values before production if needed.
insert into public.organizations (name, slug, plan)
values ('Default Organization', 'default', 'PRO')
on conflict (slug) do nothing;

insert into public.organization_settings (organization_id, display_name)
select id, name
from public.organizations
where slug = 'default'
on conflict (organization_id) do nothing;

insert into public.subscriptions (organization_id, plan, status)
select id, plan, 'active'::public.subscription_status
from public.organizations
where slug = 'default'
on conflict (organization_id) do nothing;

-- Add organization_id to known operational tables when they exist.
do $$
declare
  table_name text;
  default_org_id uuid;
  tables text[] := array[
    'products',
    'categories',
    'customers',
    'sales',
    'sale_items',
    'payments',
    'repairs',
    'inventory',
    'branches',
    'employees',
    'orders',
    'suppliers',
    'settings',
    'promotions',
    'brands',
    'cash_register_sessions',
    'cash_movements',
    'customer_credits',
    'website_settings',
    'communication_messages'
  ];
begin
  select id into default_org_id from public.organizations where slug = 'default';

  foreach table_name in array tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I add column if not exists organization_id uuid references public.organizations(id) on delete restrict', table_name);
      execute format('update public.%I set organization_id = $1 where organization_id is null', table_name) using default_org_id;
      execute format('create index if not exists %I on public.%I(organization_id)', 'idx_' || table_name || '_organization_id', table_name);
    end if;
  end loop;
end $$;

-- Policy migration for operational tables must be done table-by-table after staging verification.
-- Existing permissive policies can combine with new tenant policies, so do not assume this additive migration
-- is enough to isolate existing data. Replace legacy policies with organization-aware policies in phase 2.
