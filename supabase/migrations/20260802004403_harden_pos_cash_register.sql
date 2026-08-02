begin;

create or replace function public.cash_movement_effect(
  p_type text,
  p_payment_method text,
  p_amount numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_type = 'opening' then coalesce(p_amount, 0)
    when p_type = 'cash_in' and coalesce(p_payment_method, 'cash') in ('cash', 'efectivo') then coalesce(p_amount, 0)
    when p_type = 'sale' and coalesce(p_payment_method, 'cash') = 'cash' then coalesce(p_amount, 0)
    when p_type = 'sale' and p_payment_method = 'efectivo' then coalesce(p_amount, 0)
    when p_type = 'cash_out' and coalesce(p_payment_method, 'cash') in ('cash', 'efectivo') then -coalesce(p_amount, 0)
    else 0
  end;
$$;

create or replace function public.calculate_cash_session_expected(
  p_session_id uuid,
  p_organization_id uuid,
  p_branch_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when m.type = 'opening' then m.amount
      when m.type = 'cash_in' and coalesce(m.payment_method, 'cash') in ('cash', 'efectivo') then m.amount
      when m.type = 'sale' and coalesce(m.payment_method, 'cash') = 'cash' then m.amount
      when m.type = 'sale' and m.payment_method = 'efectivo' then m.amount
      when m.type = 'cash_out' and coalesce(m.payment_method, 'cash') in ('cash', 'efectivo') then -m.amount
      else 0
    end
  ), 0)
  from public.cash_movements m
  where m.session_id = p_session_id
    and m.organization_id = p_organization_id
    and m.branch_id = p_branch_id;
$$;

create or replace function public.sync_cash_register_balance_from_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_register_id text;
begin
  select c.register_id
  into target_register_id
  from public.cash_closures c
  where c.id = new.session_id
    and c.organization_id = new.organization_id
    and c.branch_id = new.branch_id;

  if target_register_id is not null then
    update public.cash_registers r
    set balance = coalesce(r.balance, 0)
      + public.cash_movement_effect(new.type, new.payment_method, new.amount)
    where r.id::text = target_register_id
      and r.organization_id = new.organization_id
      and r.branch_id = new.branch_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_cash_register_balance_after_movement on public.cash_movements;
create trigger sync_cash_register_balance_after_movement
after insert on public.cash_movements
for each row execute function public.sync_cash_register_balance_from_movement();

update public.cash_registers r
set is_open = exists (
  select 1
  from public.cash_closures c
  where c.organization_id = r.organization_id
    and c.branch_id = r.branch_id
    and c.register_id = r.id::text
    and c.date is null
);

with active_sessions as (
  select distinct on (c.organization_id, c.branch_id, c.register_id)
    c.id,
    c.organization_id,
    c.branch_id,
    c.register_id
  from public.cash_closures c
  where c.date is null
  order by c.organization_id, c.branch_id, c.register_id, c.created_at desc
)
update public.cash_registers r
set balance = public.calculate_cash_session_expected(
  active_sessions.id,
  active_sessions.organization_id,
  active_sessions.branch_id
)
from active_sessions
where r.id::text = active_sessions.register_id
  and r.organization_id = active_sessions.organization_id
  and r.branch_id = active_sessions.branch_id;

create or replace function public.open_cash_register_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_register_id text,
  p_opening_balance numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_session public.cash_closures%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if coalesce(trim(p_register_id), '') = '' then
    raise exception 'Register is required';
  end if;
  if coalesce(p_opening_balance, -1) < 0 then
    raise exception 'Opening balance cannot be negative';
  end if;
  if not exists (
    select 1
    from public.cash_registers r
    join public.branches b on b.id = r.branch_id
    where r.id::text = trim(p_register_id)
      and r.organization_id = p_organization_id
      and r.branch_id = p_branch_id
      and r.is_active = true
      and b.organization_id = p_organization_id
      and b.is_active = true
  ) then
    raise exception 'REGISTER_NOT_IN_BRANCH';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_branch_id::text || ':' || trim(p_register_id), 0)
  );

  if exists (
    select 1
    from public.cash_closures c
    where c.organization_id = p_organization_id
      and c.branch_id = p_branch_id
      and c.register_id = trim(p_register_id)
      and c.date is null
  ) then
    raise exception 'Register is already open';
  end if;

  update public.cash_registers r
  set is_open = true, balance = 0
  where r.id::text = trim(p_register_id)
    and r.organization_id = p_organization_id
    and r.branch_id = p_branch_id;

  insert into public.cash_closures (
    type, register_id, date, opening_balance, opened_by,
    organization_id, branch_id, notes
  ) values (
    'z', trim(p_register_id), null, p_opening_balance, actor_id::text,
    p_organization_id, p_branch_id, nullif(trim(p_note), '')
  ) returning * into created_session;

  insert into public.cash_movements (
    session_id, type, amount, reason, created_by, created_at,
    organization_id, branch_id
  ) values (
    created_session.id,
    'opening',
    p_opening_balance,
    case when nullif(trim(p_note), '') is null
      then 'Apertura de caja'
      else 'Apertura de caja - ' || trim(p_note)
    end,
    actor_id,
    now(),
    p_organization_id,
    p_branch_id
  );

  return jsonb_build_object(
    'id', created_session.id,
    'register_id', created_session.register_id,
    'opening_balance', created_session.opening_balance,
    'opened_by', created_session.opened_by,
    'opened_at', created_session.created_at,
    'organization_id', created_session.organization_id,
    'branch_id', created_session.branch_id
  );
end;
$$;

create or replace function public.record_cash_movement_atomic(
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
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_movement public.cash_movements%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if p_type not in ('cash_in', 'cash_out') then
    raise exception 'INVALID_CASH_MOVEMENT_TYPE';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'INVALID_CASH_MOVEMENT_AMOUNT';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'CASH_MOVEMENT_REASON_REQUIRED';
  end if;

  perform 1
  from public.cash_closures c
  join public.cash_registers r
    on r.id::text = c.register_id
   and r.organization_id = c.organization_id
   and r.branch_id = c.branch_id
  where c.id = p_session_id
    and c.organization_id = p_organization_id
    and c.branch_id = p_branch_id
    and c.date is null
    and r.is_active = true
  for update of c, r;

  if not found then
    raise exception 'OPEN_CASH_SESSION_NOT_FOUND';
  end if;

  insert into public.cash_movements (
    session_id, type, amount, reason, created_by, created_at,
    organization_id, branch_id
  ) values (
    p_session_id,
    p_type,
    p_amount,
    left(trim(p_reason), 500),
    actor_id,
    now(),
    p_organization_id,
    p_branch_id
  ) returning * into created_movement;

  update public.cash_closures
  set last_activity_at = now(), updated_at = now()
  where id = p_session_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id;

  return to_jsonb(created_movement);
end;
$$;

create or replace function public.close_cash_register_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_closing_balance numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_session public.cash_closures%rowtype;
  expected_total numeric;
  difference numeric;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if coalesce(p_closing_balance, -1) < 0 then
    raise exception 'Closing balance cannot be negative';
  end if;

  select * into target_session
  from public.cash_closures c
  where c.id = p_session_id
    and c.organization_id = p_organization_id
    and c.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'Cash session not found in selected branch';
  end if;
  if target_session.date is not null then
    raise exception 'Cash session is already closed';
  end if;

  expected_total := public.calculate_cash_session_expected(
    target_session.id,
    p_organization_id,
    p_branch_id
  );
  difference := p_closing_balance - expected_total;

  update public.cash_closures
  set closed_by = actor_id::text,
      closing_balance = p_closing_balance,
      expected_balance = expected_total,
      discrepancy = difference,
      date = now(),
      updated_at = now()
  where id = target_session.id;

  update public.cash_registers r
  set is_open = false, balance = p_closing_balance
  where r.id::text = target_session.register_id
    and r.organization_id = p_organization_id
    and r.branch_id = p_branch_id;

  insert into public.cash_movements (
    session_id, type, amount, reason, created_by, created_at,
    organization_id, branch_id
  ) values (
    target_session.id, 'closing', p_closing_balance, 'Cierre de caja',
    actor_id, now(), p_organization_id, p_branch_id
  );

  return jsonb_build_object(
    'id', target_session.id,
    'expected_balance', expected_total,
    'closing_balance', p_closing_balance,
    'discrepancy', difference,
    'closed_at', now()
  );
end;
$$;

create or replace function public.record_cash_count_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_counted_total numeric,
  p_denominations jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  expected_total numeric;
  created_count public.cash_counts%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if coalesce(p_counted_total, -1) < 0 then
    raise exception 'Counted total cannot be negative';
  end if;

  perform 1
  from public.cash_closures c
  where c.id = p_session_id
    and c.organization_id = p_organization_id
    and c.branch_id = p_branch_id
    and c.date is null
  for update;

  if not found then
    raise exception 'Open cash session not found in selected branch';
  end if;

  expected_total := public.calculate_cash_session_expected(
    p_session_id,
    p_organization_id,
    p_branch_id
  );

  insert into public.cash_counts (
    organization_id, branch_id, session_id, counted_total,
    expected_total, discrepancy, denominations, counted_by
  ) values (
    p_organization_id,
    p_branch_id,
    p_session_id,
    p_counted_total,
    expected_total,
    p_counted_total - expected_total,
    coalesce(p_denominations, '{}'::jsonb),
    actor_id
  ) returning * into created_count;

  return to_jsonb(created_count);
end;
$$;

drop policy if exists "tenant members can create cash movements" on public.cash_movements;
create policy "cash managers can create cash movements"
on public.cash_movements
for insert to authenticated
with check (public.has_org_permission(organization_id, 'pos.cash.manage'));

revoke all on function public.record_cash_movement_atomic(uuid, uuid, uuid, text, numeric, text)
from public, anon;
grant execute on function public.record_cash_movement_atomic(uuid, uuid, uuid, text, numeric, text)
to authenticated;

revoke all on function public.calculate_cash_session_expected(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.sync_cash_register_balance_from_movement()
from public, anon, authenticated;

commit;
