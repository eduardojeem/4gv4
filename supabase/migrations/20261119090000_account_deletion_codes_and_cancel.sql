-- Eliminación de cuenta: confirmación con código por correo y cancelación.
--
-- 1. Las cuentas que entran con Google no tienen contraseña: confirman con un
--    código de 6 dígitos que se manda al correo de la cuenta (vence a los
--    10 minutos y admite 5 intentos).
-- 2. El pedido guarda cómo estaban el perfil, las membresías, la suscripción y
--    la tienda antes de bloquear, para que soporte pueda cancelarlo dentro del
--    plazo y dejar todo como estaba.

create table if not exists public.account_deletion_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now()
);

-- Solo el servidor (service_role) la lee y la escribe.
alter table public.account_deletion_codes enable row level security;
revoke all on table public.account_deletion_codes from anon, authenticated;

alter table public.account_deletion_requests
  add column if not exists previous_state jsonb not null default '{}'::jsonb,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid;

create or replace function public.request_account_deletion(p_user_id uuid, p_source text, p_reason text default null)
returns public.account_deletion_requests
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_email text;
  v_closed uuid[];
  v_previous jsonb;
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

  -- Cómo estaba todo antes de bloquear, para poder cancelar el pedido.
  v_previous := jsonb_build_object(
    'profile_status', (select p.status from public.profiles p where p.id = p_user_id),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'status', m.status))
        from public.organization_members m where m.user_id = p_user_id
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'cancel_at_period_end', s.cancel_at_period_end))
        from public.subscriptions s where s.organization_id = any (v_closed)
    ), '[]'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'storefront_public', o.storefront_public, 'marketplace_public', o.marketplace_public))
        from public.organizations o where o.id = any (v_closed)
    ), '[]'::jsonb)
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
  delete from public.account_deletion_codes where user_id = p_user_id;

  insert into public.account_deletion_requests (user_id, email, source, reason, closed_organization_ids, previous_state)
  values (p_user_id, v_email, p_source, nullif(trim(p_reason), ''), v_closed, v_previous)
  returning * into v_request;

  return v_request;
end;
$$;

-- Cancela un pedido pendiente y deja la cuenta como estaba. El desbloqueo de
-- Auth lo hace el servidor. Las sesiones y los dispositivos borrados no
-- vuelven: la persona inicia sesión de nuevo.
create or replace function public.cancel_account_deletion(p_request_id uuid, p_actor_id uuid)
returns public.account_deletion_requests
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_previous jsonb;
begin
  select * into v_request
    from public.account_deletion_requests
   where id = p_request_id
   for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'ACCOUNT_DELETION_NOT_PENDING';
  end if;
  v_previous := coalesce(v_request.previous_state, '{}'::jsonb);

  update public.profiles
     set status = coalesce(v_previous ->> 'profile_status', 'active'), updated_at = now()
   where id = v_request.user_id;

  if v_previous ? 'memberships' then
    update public.organization_members m
       set status = s.status, updated_at = now()
      from jsonb_to_recordset(v_previous -> 'memberships') as s (id uuid, status text)
     where m.id = s.id and m.user_id = v_request.user_id and m.status = 'suspended';
  else
    -- Pedidos anteriores a esta migración: se reactivan las membresías que
    -- suspendió el pedido (las que cambiaron desde ese momento).
    update public.organization_members
       set status = 'active', updated_at = now()
     where user_id = v_request.user_id and status = 'suspended' and updated_at >= v_request.requested_at;
  end if;

  update public.subscriptions sub
     set status = s.status::public.subscription_status, cancel_at_period_end = s.cancel_at_period_end, updated_at = now()
    from jsonb_to_recordset(coalesce(v_previous -> 'subscriptions', '[]'::jsonb)) as s (id uuid, status text, cancel_at_period_end boolean)
   where sub.id = s.id and sub.status = 'canceled';

  update public.organizations o
     set storefront_public = s.storefront_public, marketplace_public = s.marketplace_public, updated_at = now()
    from jsonb_to_recordset(coalesce(v_previous -> 'organizations', '[]'::jsonb)) as s (id uuid, storefront_public boolean, marketplace_public boolean)
   where o.id = s.id;

  update public.account_deletion_requests
     set status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor_id
   where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.request_account_deletion(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_account_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid, text, text) to service_role;
grant execute on function public.cancel_account_deletion(uuid, uuid) to service_role;
