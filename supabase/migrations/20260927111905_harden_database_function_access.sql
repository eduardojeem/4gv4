-- Harden privileged RPCs exposed through the public Data API.
-- Application entry points authenticate and authorize callers before using service_role.

create or replace function public.get_user_active_sessions(p_user_id uuid)
returns setof public.user_sessions
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'SESSION_USER_MISMATCH' using errcode = 'insufficient_privilege';
  end if;

  return query
  select session_row.*
  from public.user_sessions session_row
  where session_row.user_id = p_user_id
    and session_row.is_active = true
  order by session_row.last_activity desc;
end;
$function$;

create or replace function public.get_user_activity(p_user_id uuid, p_limit integer default 50)
returns setof public.user_activity
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'SESSION_USER_MISMATCH' using errcode = 'insufficient_privilege';
  end if;

  return query
  select activity_row.*
  from public.user_activity activity_row
  where activity_row.user_id = p_user_id
  order by activity_row.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$function$;

create or replace function public.close_user_session(p_session_id text, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  affected integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'SESSION_USER_MISMATCH' using errcode = 'insufficient_privilege';
  end if;

  update public.user_sessions
  set is_active = false,
      last_activity = now()
  where session_id = p_session_id
    and user_id = p_user_id
    and is_active = true;

  get diagnostics affected = row_count;

  if affected > 0 then
    return json_build_object('success', true, 'message', 'Sesion cerrada correctamente');
  end if;

  return json_build_object('success', false, 'message', 'Sesion no encontrada o ya cerrada');
end;
$function$;

create or replace function public.close_all_user_sessions_except_current(p_user_id uuid, p_current_session_id text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  affected integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'SESSION_USER_MISMATCH' using errcode = 'insufficient_privilege';
  end if;

  update public.user_sessions
  set is_active = false,
      last_activity = now()
  where user_id = p_user_id
    and session_id <> p_current_session_id
    and is_active = true;

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

create or replace function public.get_default_dashboard_organization(p_user_id uuid default auth.uid())
returns table(organization_id uuid, organization_slug text, membership_role text)
language sql
stable
set search_path = pg_catalog, public, auth
as $function$
  with memberships as (
    select om.organization_id, o.slug as organization_slug, om.role::text as membership_role,
      case when om.role::text in ('owner', 'admin') then 1 when om.role::text in ('manager', 'staff') then 2
           when om.role::text = 'customer' then 3 else 99 end as role_priority,
      om.created_at
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where p_user_id = auth.uid()
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
  select memberships.organization_id, memberships.organization_slug, memberships.membership_role
  from memberships
  order by memberships.role_priority asc, memberships.created_at asc
  limit 1;
$function$;

alter function public.check_long_open_sessions() set search_path = pg_catalog, public;
alter function public.update_website_settings_updated_at() set search_path = pg_catalog, public;
alter function public.pos_first_installment_payment_version() set search_path = pg_catalog;

revoke all on function public.get_user_active_sessions(uuid) from public, anon, authenticated;
revoke all on function public.get_user_activity(uuid, integer) from public, anon, authenticated;
revoke all on function public.close_user_session(text, uuid) from public, anon, authenticated;
revoke all on function public.close_all_user_sessions_except_current(uuid, text) from public, anon, authenticated;
grant execute on function public.get_user_active_sessions(uuid) to authenticated;
grant execute on function public.get_user_activity(uuid, integer) to authenticated;
grant execute on function public.close_user_session(text, uuid) to authenticated;
grant execute on function public.close_all_user_sessions_except_current(uuid, text) to authenticated;

revoke all on function public.process_pos_sale_atomic_v4(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) from public, anon, authenticated;
revoke all on function public.process_pos_sale_atomic_v5(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) from public, anon, authenticated;
grant execute on function public.process_pos_sale_atomic_v4(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) to service_role;
grant execute on function public.process_pos_sale_atomic_v5(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) to service_role;

revoke all on function public.open_plan_downgrade_grace(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.enforce_plan_downgrade_deactivation(uuid) from public, anon, authenticated;
revoke all on function public.enforce_plan_downgrade_archive(uuid) from public, anon, authenticated;
revoke all on function public.resolve_plan_downgrade_grace(uuid) from public, anon, authenticated;
revoke all on function public.rank_products_by_sales(uuid) from public, anon, authenticated;
revoke all on function public.sync_product_total_stock(uuid) from public, anon, authenticated;
grant execute on function public.open_plan_downgrade_grace(uuid, text, integer) to service_role;
grant execute on function public.enforce_plan_downgrade_deactivation(uuid) to service_role;
grant execute on function public.enforce_plan_downgrade_archive(uuid) to service_role;
grant execute on function public.resolve_plan_downgrade_grace(uuid) to service_role;
grant execute on function public.rank_products_by_sales(uuid) to service_role;
grant execute on function public.sync_product_total_stock(uuid) to service_role;

revoke all on function public.get_database_growth_history(integer) from public, anon, authenticated;
revoke all on function public.get_database_size_info() from public, anon, authenticated;
revoke all on function public.get_database_stats() from public, anon, authenticated;
revoke all on function public.get_index_stats() from public, anon, authenticated;
revoke all on function public.get_query_performance() from public, anon, authenticated;
revoke all on function public.get_table_sizes() from public, anon, authenticated;
revoke all on function public.record_database_growth_snapshot() from public, anon, authenticated;
grant execute on function public.get_database_growth_history(integer) to service_role;
grant execute on function public.get_database_size_info() to service_role;
grant execute on function public.get_database_stats() to service_role;
grant execute on function public.get_index_stats() to service_role;
grant execute on function public.get_query_performance() to service_role;
grant execute on function public.get_table_sizes() to service_role;
grant execute on function public.record_database_growth_snapshot() to service_role;

revoke all on function public.get_default_branch_id() from public, anon, authenticated;
revoke all on function public.check_long_open_sessions() from public, anon, authenticated;
grant execute on function public.get_default_branch_id() to service_role;
grant execute on function public.check_long_open_sessions() to service_role;
revoke all on function public.get_default_dashboard_organization(uuid) from public, anon, authenticated;
grant execute on function public.get_default_dashboard_organization(uuid) to authenticated;

revoke all on function public.capture_customer_order_item_cost() from public, anon, authenticated;
revoke all on function public.compute_loyalty_balance_after() from public, anon, authenticated;
revoke all on function public.fill_product_movement_scope() from public, anon, authenticated;
revoke all on function public.log_sale_item_stock_movement() from public, anon, authenticated;
revoke all on function public.normalize_popular_subscription_plan() from public, anon, authenticated;
revoke all on function public.sync_customer_store_credit_balance() from public, anon, authenticated;
revoke all on function public.sync_loyalty_account_from_ledger() from public, anon, authenticated;
revoke all on function public.sync_product_total_stock_trigger() from public, anon, authenticated;
revoke all on function public.update_website_settings_updated_at() from public, anon, authenticated;

revoke all on table public.email_logs from anon, authenticated;
revoke all on table public.storefront_daily_visits from anon, authenticated;
revoke all on table public.support_sessions from anon, authenticated;

-- User aggregates contain platform-wide data and are service-only.
revoke all on table public.user_stats_cache from public, anon, authenticated;
alter function public.refresh_user_stats_cache() set search_path = pg_catalog, public;
revoke all on function public.refresh_user_stats_cache() from public, anon, authenticated;
grant execute on function public.refresh_user_stats_cache() to service_role;
