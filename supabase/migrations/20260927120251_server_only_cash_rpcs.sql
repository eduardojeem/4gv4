-- Keep privileged cash mutations behind authenticated server routes while
-- preserving the real operator in the database audit trail.

create or replace function public.assert_service_cash_actor(p_actor_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_actor_user_id is null then
    raise exception 'ACTOR_REQUIRED';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
end;
$$;

revoke all on function public.assert_service_cash_actor(uuid) from public, anon, authenticated;
grant execute on function public.assert_service_cash_actor(uuid) to service_role;

create or replace function public.server_open_cash_register_atomic(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_register_id text,
  p_opening_balance numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  return public.open_cash_register_atomic(
    p_organization_id, p_branch_id, p_register_id, p_opening_balance, p_note
  );
end;
$$;

create or replace function public.server_close_cash_register_atomic(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_closing_balance numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  return public.close_cash_register_atomic(
    p_organization_id, p_branch_id, p_session_id, p_closing_balance
  );
end;
$$;

create or replace function public.server_record_cash_count_atomic(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_counted_total numeric,
  p_denominations jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  return public.record_cash_count_atomic(
    p_organization_id, p_branch_id, p_session_id, p_counted_total, p_denominations
  );
end;
$$;

create or replace function public.server_record_cash_movement_atomic(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_type text,
  p_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  return public.record_cash_movement_atomic(
    p_organization_id, p_branch_id, p_session_id, p_type, p_amount, p_reason
  );
end;
$$;

create or replace function public.server_perform_cash_admin_action(
  p_actor_user_id uuid,
  p_session_id uuid,
  p_action text,
  p_reason text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  return public.perform_cash_admin_action(
    p_session_id, p_action, p_reason, p_user_agent
  );
end;
$$;

create or replace function public.server_reconcile_sale_payment_atomic(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_payment_id uuid,
  p_status text,
  p_fee_amount numeric default 0,
  p_provider text default null,
  p_institution text default null,
  p_channel text default null,
  p_terminal_id text default null,
  p_notes text default null,
  p_settled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  return public.reconcile_sale_payment_atomic(
    p_organization_id, p_branch_id, p_payment_id, p_status, p_fee_amount,
    p_provider, p_institution, p_channel, p_terminal_id, p_notes, p_settled_at
  );
end;
$$;

revoke all on function public.open_cash_register_atomic(uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.close_cash_register_atomic(uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.record_cash_count_atomic(uuid, uuid, uuid, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.record_cash_movement_atomic(uuid, uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.perform_cash_admin_action(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.reconcile_sale_payment_atomic(uuid, uuid, uuid, text, numeric, text, text, text, text, text, timestamptz) from public, anon, authenticated;

revoke all on function public.server_open_cash_register_atomic(uuid, uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.server_close_cash_register_atomic(uuid, uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.server_record_cash_count_atomic(uuid, uuid, uuid, uuid, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.server_record_cash_movement_atomic(uuid, uuid, uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.server_perform_cash_admin_action(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.server_reconcile_sale_payment_atomic(uuid, uuid, uuid, uuid, text, numeric, text, text, text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.server_open_cash_register_atomic(uuid, uuid, uuid, text, numeric, text) to service_role;
grant execute on function public.server_close_cash_register_atomic(uuid, uuid, uuid, uuid, numeric) to service_role;
grant execute on function public.server_record_cash_count_atomic(uuid, uuid, uuid, uuid, numeric, jsonb) to service_role;
grant execute on function public.server_record_cash_movement_atomic(uuid, uuid, uuid, uuid, text, numeric, text) to service_role;
grant execute on function public.server_perform_cash_admin_action(uuid, uuid, text, text, text) to service_role;
grant execute on function public.server_reconcile_sale_payment_atomic(uuid, uuid, uuid, uuid, text, numeric, text, text, text, text, text, timestamptz) to service_role;
