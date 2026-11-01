-- Ciclo de vida de los planes: que el exceso de productos se regularice por un
-- solo camino, sea cual sea la forma en que cambió el plan, y que los
-- vencimientos corran solos.
--
-- 1. Al subir de plan (pago con Pagopar o Stripe, transferencia aprobada,
--    superadmin) nadie llamaba a resolve_plan_downgrade_grace: los productos
--    apagados por una baja seguían apagados aunque la pantalla promete que se
--    reactivan. Al bajar por impago o al cambiar a un plan pago más chico, en
--    cambio, no se abría el plazo para el exceso.
--    Ahora un disparador sobre subscriptions.plan decide en todos los casos:
--    entra todo en el plan nuevo → se reactiva y se cierra el ciclo; sobra →
--    se abre el plazo (sin reiniciar uno en curso).
-- 2. Una cancelación programada que vence pasa directo a Gratuito, en vez de
--    quedar marcada como impaga hasta que alguien abriera el panel.
-- 3. Los vencimientos y el avance del plazo de productos quedan programados
--    con pg_cron (nombres fijos: volver a programar reemplaza, no duplica).

-- Límite de productos de un plan. Sin fila en plans se usan los mismos valores
-- por defecto que la aplicación (DEFAULT_LIMITS en subscription-service.ts).
create or replace function public.plan_product_limit(p_plan_code text)
returns integer language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_code text := upper(coalesce(nullif(trim(p_plan_code), ''), 'FREE'));
  v_limits jsonb;
begin
  select limits into v_limits from public.plans where upper(code) = v_code limit 1;
  if v_limits is not null and v_limits ? 'products' then
    return nullif(v_limits->>'products', '')::integer;
  end if;
  return case v_code
    when 'FREE' then 50
    when 'BASIC' then 500
    when 'PRO' then 5000
    else null
  end;
end;
$$;

create or replace function public.sync_plan_downgrade_grace(p_organization_id uuid, p_plan_code text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_limit integer := public.plan_product_limit(p_plan_code);
  v_active integer;
  v_paused integer;
begin
  select count(*) filter (where is_active and archived_by_plan_at is null),
         count(*) filter (where deactivated_by_plan)
    into v_active, v_paused
    from public.products
   where organization_id = p_organization_id;

  if v_limit is null or v_active + v_paused <= v_limit then
    -- Entra todo: se reactiva lo que apagó el ciclo y se lo da por cerrado.
    if v_paused > 0 or exists (
      select 1 from public.plan_downgrade_grace
       where organization_id = p_organization_id and stage <> 'resolved'
    ) then
      perform public.resolve_plan_downgrade_grace(p_organization_id);
    end if;
  elsif v_active > v_limit then
    perform public.open_plan_downgrade_grace(p_organization_id, upper(p_plan_code), v_limit);
  end if;
end;
$$;

create or replace function public.subscriptions_sync_downgrade_grace()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.sync_plan_downgrade_grace(new.organization_id, new.plan);
  return new;
end;
$$;

drop trigger if exists subscriptions_sync_downgrade_grace on public.subscriptions;
create trigger subscriptions_sync_downgrade_grace
  after insert or update of plan on public.subscriptions
  for each row
  when (new.plan is not null)
  execute function public.subscriptions_sync_downgrade_grace();

-- Vencimientos: la cancelación programada baja a Gratuito; el resto pasa a
-- pago pendiente (y downgrade_overdue_accounts lo baja a los 7 días).
create or replace function public.expire_paid_periods()
returns integer language plpgsql security definer set search_path = public as $$
declare
  target record;
  affected integer := 0;
  pending integer;
begin
  for target in
    select organization_id
      from public.subscriptions
     where cancel_at_period_end = true
       and coalesce(plan, 'FREE') <> 'FREE'
       and current_period_ends_at is not null
       and current_period_ends_at < now()
     for update skip locked
  loop
    perform public.apply_free_subscription_plan(target.organization_id, 'FREE');
    affected := affected + 1;
  end loop;

  update public.subscriptions
     set status = 'past_due',
         payment_status = 'unpaid',
         updated_at = now()
   where status = 'active'
     and coalesce(cancel_at_period_end, false) = false
     and coalesce(plan, 'FREE') <> 'FREE'
     and current_period_ends_at is not null
     and current_period_ends_at < now();

  get diagnostics pending = row_count;
  return affected + pending;
end;
$$;

revoke all on function public.plan_product_limit(text) from public, anon, authenticated;
revoke all on function public.sync_plan_downgrade_grace(uuid, text) from public, anon, authenticated;
revoke all on function public.subscriptions_sync_downgrade_grace() from public, anon, authenticated;
revoke all on function public.expire_paid_periods() from public, anon, authenticated;
grant execute on function public.plan_product_limit(text) to service_role;
grant execute on function public.sync_plan_downgrade_grace(uuid, text) to service_role;
grant execute on function public.expire_paid_periods() to service_role;

-- Los productos que ya quedaron apagados por una baja se reevalúan una vez con
-- el plan vigente: los de quien ya volvió a pagar un plan mayor se reactivan.
do $$
declare
  target record;
begin
  for target in
    select distinct s.organization_id, s.plan
      from public.subscriptions s
     where s.plan is not null
       and (
         exists (select 1 from public.plan_downgrade_grace g where g.organization_id = s.organization_id and g.stage <> 'resolved')
         or exists (select 1 from public.products p where p.organization_id = s.organization_id and p.deactivated_by_plan)
       )
  loop
    perform public.sync_plan_downgrade_grace(target.organization_id, target.plan);
  end loop;
end;
$$;

-- Tareas diarias (madrugada en Paraguay, después de los puntos de fidelidad).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('subscriptions_expire_paid_periods', '15 6 * * *', 'select public.expire_paid_periods()');
    perform cron.schedule('subscriptions_downgrade_overdue', '30 6 * * *', 'select public.downgrade_overdue_accounts()');
    perform cron.schedule('plan_downgrade_grace_process', '45 6 * * *', 'select public.process_plan_downgrade_grace()');
  else
    raise notice 'pg_cron no está disponible: programar expire_paid_periods, downgrade_overdue_accounts y process_plan_downgrade_grace.';
  end if;
end;
$$;
