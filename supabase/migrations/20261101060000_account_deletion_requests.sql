-- Eliminación de cuenta a pedido del usuario (requisito de Google Play).
--
-- Al pedirla, la cuenta se bloquea en el momento: perfil inactivo, membresías
-- suspendidas y sesiones y dispositivos borrados. Si era el único dueño o
-- administrador de un negocio, el negocio se cierra (suscripción cancelada y
-- tienda despublicada).
-- A los 30 días, la tarea diaria anonimiza los datos personales. El usuario de
-- Auth no se borra: ventas, caja y finanzas lo referencian sin ON DELETE, y
-- esos registros comerciales y fiscales se conservan sin datos personales.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  -- Sin FK: el registro tiene que sobrevivir a la anonimización.
  user_id uuid not null,
  email text,
  source text not null check (source in ('app', 'web', 'support')),
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now() + interval '30 days',
  completed_at timestamptz,
  closed_organization_ids uuid[] not null default '{}'
);

create unique index if not exists account_deletion_requests_one_pending
  on public.account_deletion_requests (user_id) where status = 'pending';
create index if not exists account_deletion_requests_due
  on public.account_deletion_requests (scheduled_for) where status = 'pending';

-- Solo el servidor (service_role) la lee y la escribe.
alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from anon, authenticated;

create or replace function public.request_account_deletion(p_user_id uuid, p_source text, p_reason text default null)
returns public.account_deletion_requests
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_email text;
  v_closed uuid[];
begin
  select * into v_request
    from public.account_deletion_requests
   where user_id = p_user_id and status = 'pending';
  if found then
    return v_request;
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  -- Negocios donde es dueño o administrador activo y nadie más lo es.
  select coalesce(array_agg(distinct m.organization_id), '{}') into v_closed
    from public.organization_members m
   where m.user_id = p_user_id
     and m.status = 'active'
     and m.role in ('owner', 'admin')
     and not exists (
       select 1 from public.organization_members other
        where other.organization_id = m.organization_id
          and other.user_id <> p_user_id
          and other.status = 'active'
          and other.role in ('owner', 'admin')
     );

  update public.subscriptions
     set status = 'canceled', cancel_at_period_end = false, updated_at = now()
   where organization_id = any (v_closed);
  update public.organizations
     set storefront_public = false, marketplace_public = false, updated_at = now()
   where id = any (v_closed);

  update public.profiles set status = 'inactive', updated_at = now() where id = p_user_id;
  update public.organization_members set status = 'suspended', updated_at = now() where user_id = p_user_id;
  delete from public.push_devices where user_id = p_user_id;
  delete from public.user_sessions where user_id = p_user_id;

  insert into public.account_deletion_requests (user_id, email, source, reason, closed_organization_ids)
  values (p_user_id, v_email, p_source, nullif(trim(p_reason), ''), v_closed)
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.complete_account_deletion(p_request_id uuid)
returns public.account_deletion_requests
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_request public.account_deletion_requests%rowtype;
begin
  select * into v_request
    from public.account_deletion_requests
   where id = p_request_id
   for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'ACCOUNT_DELETION_NOT_PENDING';
  end if;

  update public.profiles
     set full_name = 'Cuenta eliminada',
         display_name = null,
         username = null,
         email = null,
         phone = null,
         avatar_url = null,
         bio = null,
         website = null,
         location = null,
         title = null,
         job_title = null,
         social_links = '{}'::jsonb,
         is_public = false,
         status = 'inactive',
         updated_at = now()
   where id = v_request.user_id;

  delete from public.push_devices where user_id = v_request.user_id;
  delete from public.user_sessions where user_id = v_request.user_id;
  delete from public.notification_preferences where user_id = v_request.user_id;
  delete from public.notifications where user_id = v_request.user_id;
  delete from public.user_security_settings where user_id = v_request.user_id;
  delete from public.customer_carts where user_id = v_request.user_id;
  delete from public.public_product_favorites where user_id = v_request.user_id;
  delete from public.marketplace_user_preferences where user_id = v_request.user_id;

  update public.account_deletion_requests
     set status = 'completed', completed_at = now(), email = null
   where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.request_account_deletion(uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid, text, text) to service_role;
grant execute on function public.complete_account_deletion(uuid) to service_role;
