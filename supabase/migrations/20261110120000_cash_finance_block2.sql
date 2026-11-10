-- Bloque 2 de la auditoría de caja y Finanzas: anulaciones que devuelven todo,
-- gastos pagados desde la caja, seña de reparaciones canceladas, precio estable
-- tras un cierre sin reparar, servicios sin stock y transferencias sin caja.
--
-- No reescribe migraciones viejas. Las funciones grandes del POS y de cobro de
-- reparaciones se parchean leyendo su definición actual y reemplazando solo
-- las líneas necesarias; si el texto esperado cambió, la migración falla en vez
-- de pisar algo distinto.
begin;

-- ─── 1. Ledger de cobros de reparación: un cobro anulado queda marcado ───────
alter table public.repair_payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text;

-- ─── 2. Cierres: también la seña de una reparación cancelada ─────────────────
alter table public.repair_closeouts drop constraint if exists repair_closeouts_outcome_check;
alter table public.repair_closeouts add constraint repair_closeouts_outcome_check
  check (outcome = any (array['withdrawn'::text, 'unrepairable'::text, 'cancelled'::text]));

-- El saldo a favor que vuelve por una anulación tiene su propio origen: el
-- índice único de `source_type='sale'` admite un solo movimiento por venta (el
-- débito al usarlo).
alter table public.customer_store_credits drop constraint if exists customer_store_credits_source_type_check;
alter table public.customer_store_credits add constraint customer_store_credits_source_type_check check (
  source_type = any (array['after_sales', 'sale', 'sale_void', 'repair', 'order', 'order_refund', 'manual', 'loyalty'])
);

-- ─── 3. Anular una venta devuelve todo ───────────────────────────────────────
-- Además de stock, cuotas y efectivo (como antes):
--   · las reparaciones que la venta cobró vuelven a deber lo cobrado;
--   · el saldo a favor que usó el cliente vuelve a su cuenta;
--   · se descuentan los puntos que sumó la compra;
--   · el turno cobrado queda libre para volver a cobrarse;
--   · un servicio no suma stock al anular;
--   · el efectivo sale de la caja que abrió quien anula, si tiene una abierta.
create or replace function public.void_pos_sale(
  p_sale_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  sale public.sales%rowtype;
  item record;
  credit record;
  repair_row record;
  paid_installments integer := 0;
  cancelled_installments integer := 0;
  restored_units integer := 0;
  cash_total numeric := 0;
  open_session uuid;
  inventory_rows integer := 0;
  motivo text := nullif(trim(coalesce(p_reason, '')), '');
  repairs_reopened integer := 0;
  store_credit_returned numeric := 0;
  points_earned integer := 0;
  points_reversed integer := 0;
  points_balance integer := 0;
  points_removed integer := 0;
  appointments_released integer := 0;
  repair_total numeric := 0;
  repair_paid numeric := 0;
begin
  select * into sale
  from public.sales
  where id = p_sale_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'SALE_NOT_IN_ORGANIZATION';
  end if;

  -- Anular dos veces no puede devolver el stock dos veces.
  if sale.status = 'cancelled' then
    return jsonb_build_object('sale_id', sale.id, 'already_voided', true);
  end if;

  -- Si ya hubo pagos del crédito, se conserva la regla y su historial.
  for credit in
    select c.id
    from public.customer_credits c
    where c.sale_id = p_sale_id and c.organization_id = p_organization_id
  loop
    select count(*) into paid_installments
    from public.credit_installments i
    where i.credit_id = credit.id and coalesce(i.amount_paid, 0) > 0;

    if paid_installments > 0 then
      raise exception 'SALE_CREDIT_ALREADY_PAID';
    end if;
  end loop;

  -- ── Stock: se devuelve lo que la venta descontó (los servicios no tienen) ──
  for item in
    select si.product_id, si.variant_id, sum(si.quantity)::integer as quantity
    from public.sale_items si
    join public.products product on product.id = si.product_id
    where si.sale_id = p_sale_id and si.organization_id = p_organization_id
      and lower(coalesce(product.unit_measure, '')) <> 'servicio'
    group by si.product_id, si.variant_id
  loop
    if item.variant_id is not null then
      perform public.adjust_variant_stock_atomic(
        p_organization_id, sale.branch_id, item.variant_id, item.quantity,
        'return', 'void-sale:' || p_sale_id::text || ':' || item.variant_id::text,
        p_actor_id, 'sale', p_sale_id, 'Anulación de venta',
        jsonb_build_object('sale_id', p_sale_id, 'voided', true)
      );
    else
      update public.branch_inventory
      set stock_quantity = stock_quantity + item.quantity, updated_at = now()
      where branch_id = sale.branch_id and product_id = item.product_id;
      get diagnostics inventory_rows = row_count;

      -- Legacy products without a branch row still retain their aggregate stock.
      if inventory_rows = 0 then
        update public.products
        set stock_quantity = stock_quantity + item.quantity, updated_at = now()
        where id = item.product_id and organization_id = p_organization_id;
      end if;
    end if;

    restored_units := restored_units + item.quantity;
  end loop;

  -- ── Crédito: cuotas impagas canceladas y crédito cerrado ──
  for credit in
    select c.id
    from public.customer_credits c
    where c.sale_id = p_sale_id and c.organization_id = p_organization_id
  loop
    update public.credit_installments
    set status = 'cancelled', updated_at = now()
    where credit_id = credit.id and status <> 'paid';
    get diagnostics cancelled_installments = row_count;

    update public.customer_credits
    set status = 'cancelled',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'voided_with_sale', p_sale_id, 'voided_at', now(), 'voided_by', p_actor_id)
    where id = credit.id;
  end loop;

  -- ── Reparaciones cobradas en esta venta: vuelven a deber lo cobrado ──
  -- El equipo ya se entregó: queda en «Te deben» hasta que se cobre de nuevo.
  for repair_row in
    select payment.repair_id, sum(payment.amount)::numeric as amount
    from public.repair_payments payment
    where payment.sale_id = p_sale_id
      and payment.organization_id = p_organization_id
      and payment.voided_at is null
    group by payment.repair_id
  loop
    select coalesce(repair.final_cost, repair.estimated_cost, 0), greatest(0, coalesce(repair.paid_amount, 0) - repair_row.amount)
    into repair_total, repair_paid
    from public.repairs repair
    where repair.id = repair_row.repair_id and repair.organization_id = p_organization_id
    for update;

    update public.repairs
    set paid_amount = repair_paid,
        payment_status = case
          when repair_total > 0 and repair_paid >= repair_total then 'pagado'
          when repair_paid > 0 then 'parcial'
          else 'pendiente'
        end,
        updated_at = now()
    where id = repair_row.repair_id and organization_id = p_organization_id;

    update public.repair_payments
    set voided_at = now(), voided_by = p_actor_id,
        void_reason = left('Anulación de venta ' || coalesce(sale.code, p_sale_id::text)
          || case when motivo is null then '' else ' — ' || motivo end, 500)
    where sale_id = p_sale_id and repair_id = repair_row.repair_id
      and organization_id = p_organization_id and voided_at is null;

    repairs_reopened := repairs_reopened + 1;
  end loop;

  -- ── Saldo a favor usado en la venta: vuelve al cliente ──
  if sale.customer_id is not null then
    select coalesce(-sum(credit_entry.amount), 0) into store_credit_returned
    from public.customer_store_credits credit_entry
    where credit_entry.organization_id = p_organization_id
      and credit_entry.source_type = 'sale'
      and credit_entry.source_id = p_sale_id;

    if store_credit_returned > 0 and not exists (
      select 1 from public.customer_store_credits returned
      where returned.organization_id = p_organization_id
        and returned.source_type = 'sale_void' and returned.source_id = p_sale_id
    ) then
      insert into public.customer_store_credits (
        organization_id, customer_id, amount, reason, source_type, source_id, created_by
      ) values (
        p_organization_id, sale.customer_id, store_credit_returned,
        'Devuelto por anulación de venta ' || coalesce(sale.code, p_sale_id::text),
        'sale_void', p_sale_id, p_actor_id
      );
    else
      store_credit_returned := 0;
    end if;

    -- ── Puntos sumados con la compra: se descuentan (nunca saldo negativo) ──
    select coalesce(sum(points), 0) into points_earned
    from public.loyalty_ledger
    where organization_id = p_organization_id and customer_id = sale.customer_id
      and sale_id = p_sale_id and source in ('purchase', 'promotion');
    select coalesce(-sum(points), 0) into points_reversed
    from public.loyalty_ledger
    where organization_id = p_organization_id and customer_id = sale.customer_id
      and sale_id = p_sale_id and source = 'reversal';
    if points_earned - points_reversed > 0 then
      select coalesce(balance, 0) into points_balance
      from public.loyalty_accounts
      where customer_id = sale.customer_id
      for update;
      points_removed := least(points_earned - points_reversed, coalesce(points_balance, 0));
      if points_removed > 0 and not exists (
        select 1 from public.loyalty_ledger
        where organization_id = p_organization_id and idempotency_key = 'void-sale:' || p_sale_id::text
      ) then
        insert into public.loyalty_ledger (
          organization_id, customer_id, points, balance_after, source, description, sale_id, idempotency_key, created_by
        ) values (
          p_organization_id, sale.customer_id, -points_removed, 0, 'reversal',
          format('Anulación de venta: se descuentan %s puntos de la compra', points_removed),
          p_sale_id, 'void-sale:' || p_sale_id::text, p_actor_id
        );
      else
        points_removed := 0;
      end if;
    end if;
  end if;

  -- ── Turno cobrado con esta venta: queda libre para cobrarse de nuevo ──
  update public.appointments
  set sale_id = null, pos_idempotency_key = null, pos_request_hash = null
  where organization_id = p_organization_id and sale_id = p_sale_id;
  get diagnostics appointments_released = row_count;

  -- ── Caja: se revierte solamente el efectivo ya cobrado ──
  select coalesce(sum(sp.amount), 0) into cash_total
  from public.sale_payments sp
  where sp.sale_id = p_sale_id
    and sp.organization_id = p_organization_id
    and lower(sp.payment_method) = 'cash';

  if cash_total > 0 then
    -- La caja de quien anula; si no abrió ninguna, la más reciente de la sucursal.
    select cc.id into open_session
    from public.cash_closures cc
    where cc.organization_id = p_organization_id
      and cc.branch_id = sale.branch_id
      and cc.date is null
    order by (cc.opened_by = p_actor_id::text) desc nulls last, cc.created_at desc
    limit 1;

    if open_session is null then
      raise exception 'VOID_REQUIRES_OPEN_REGISTER';
    end if;

    insert into public.cash_movements (
      session_id, type, amount, reason, payment_method, created_by, created_at,
      organization_id, branch_id
    ) values (
      open_session, 'cash_out', cash_total,
      'Anulación de venta ' || coalesce(sale.code, p_sale_id::text)
        || case when motivo is null then '' else ' — ' || motivo end,
      'cash', p_actor_id, now(), p_organization_id, sale.branch_id
    );
  end if;

  update public.sales
  set status = 'cancelled',
      payment_status = 'cancelled',
      notes = trim(both E'\n' from coalesce(notes, '') || E'\n[ANULADA ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']'
        || case when motivo is null then '' else ' ' || motivo end),
      updated_at = now()
  where id = p_sale_id;

  return jsonb_build_object(
    'sale_id', sale.id,
    'already_voided', false,
    'restored_units', restored_units,
    'cancelled_installments', cancelled_installments,
    'cash_returned', cash_total,
    'repairs_reopened', repairs_reopened,
    'store_credit_returned', store_credit_returned,
    'points_removed', points_removed,
    'appointments_released', appointments_released
  );
end
$function$;

-- ─── 3b. Pago de gasto en efectivo: el movimiento de caja fallaba ────────────
-- El trigger armaba el tipo con un CASE de texto y `cash_movements.type` es un
-- enum: todo pago de un gasto en efectivo desde una caja daba «column "type" is
-- of type cash_movement_type but expression is of type text» y se cancelaba.
create or replace function public.post_finance_cash_movement_from_payment()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  obligation_concept text;
begin
  if new.payment_method <> 'cash' then
    return new;
  end if;

  select obligation.concept
  into obligation_concept
  from public.finance_obligations obligation
  where obligation.id = new.obligation_id
    and obligation.organization_id = new.organization_id
    and obligation.branch_id = new.branch_id;

  insert into public.cash_movements (
    session_id, type, amount, reason, payment_method, created_by, created_at,
    organization_id, branch_id, finance_payment_id
  ) values (
    new.cash_session_id,
    (case when new.direction = 'payment' then 'cash_out' else 'cash_in' end)::public.cash_movement_type,
    new.amount,
    left(
      case when new.direction = 'payment'
        then 'Pago de gasto: '
        else 'Compensacion por anulacion: '
      end || obligation_concept,
      500
    ),
    'cash',
    new.created_by,
    now(),
    new.organization_id,
    new.branch_id,
    new.id
  );

  update public.cash_closures
  set last_activity_at = now(), updated_at = now()
  where id = new.cash_session_id
    and organization_id = new.organization_id
    and branch_id = new.branch_id;

  return new;
end;
$$;

-- Lo mismo en el control de esos movimientos y en los de sueldos: comparar el
-- enum con un CASE de texto no existe como operador y el pago se cancelaba.
do $fix$
declare
  fn_name text;
  source text;
begin
  foreach fn_name in array array['validate_finance_cash_movement_insert', 'validate_payroll_cash_movement_insert'] loop
    select pg_get_functiondef(p.oid) into source from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = fn_name;
    if source is null then continue; end if;
    if position('new.type::text = case' in source) = 0 then
      if position('new.type = case' in source) = 0 then raise exception 'CASH_MOVEMENT_VALIDATION_CONTRACT_CHANGED|%', fn_name; end if;
      execute replace(source, 'new.type = case', 'new.type::text = case');
    end if;
  end loop;

  select pg_get_functiondef(p.oid) into source from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'post_payroll_cash_movement_from_payment';
  if source is not null and position('::public.cash_movement_type' in source) = 0 then
    if position('case when new.direction = ''payment'' then ''cash_out'' else ''cash_in'' end,' in source) = 0 then
      raise exception 'PAYROLL_CASH_MOVEMENT_CONTRACT_CHANGED';
    end if;
    execute replace(source,
      'case when new.direction = ''payment'' then ''cash_out'' else ''cash_in'' end,',
      '(case when new.direction = ''payment'' then ''cash_out'' else ''cash_in'' end)::public.cash_movement_type,');
  end if;
end
$fix$;

-- ─── 4. Gasto pagado con plata de la caja ────────────────────────────────────
-- Un egreso manual era un `cash_out` suelto: la caja cuadraba pero Finanzas no
-- veía el gasto. Ahora se crea el gasto (con su categoría) y se paga desde la
-- sesión: el movimiento de caja lo crea el trigger de `finance_payments`, igual
-- que un pago hecho desde Finanzas. Lo usa la ruta del POS con la clave de
-- servicio; el cajero no necesita permiso de Finanzas.
create or replace function public.server_record_cash_expense_atomic(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_session_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_concept text,
  p_accounting_date date,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  obligation public.finance_obligations%rowtype;
  payment public.finance_payments%rowtype;
  movement public.cash_movements%rowtype;
  creation_key text := 'cash-expense:' || trim(coalesce(p_idempotency_key, ''));
  concept text := nullif(left(trim(coalesce(p_concept, '')), 200), '');
begin
  perform public.assert_service_cash_actor(p_actor_user_id);

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null or char_length(creation_key) > 120 then
    raise exception 'FINANCE_INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 or p_amount <> trunc(p_amount, 2) then
    raise exception 'FINANCE_INVALID_PAYMENT_AMOUNT';
  end if;
  if concept is null then raise exception 'CASH_EXPENSE_CONCEPT_REQUIRED'; end if;
  if p_accounting_date is null then raise exception 'FINANCE_PAYMENT_DATE_REQUIRED'; end if;
  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id and member.user_id = p_actor_user_id
      and member.status = 'active' and member.role <> 'customer'
  ) then
    raise exception 'CASH_EXPENSE_ACTOR_NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.finance_categories category
    where category.id = p_category_id and category.organization_id = p_organization_id
      and category.is_active = true
  ) then
    raise exception 'FINANCE_CATEGORY_NOT_FOUND';
  end if;

  -- Reintento con la misma clave: devuelve lo ya registrado.
  select * into obligation from public.finance_obligations existing
  where existing.organization_id = p_organization_id and existing.creation_idempotency_key = creation_key;
  if found then
    select * into payment from public.finance_payments existing_payment
    where existing_payment.organization_id = p_organization_id and existing_payment.obligation_id = obligation.id
    order by existing_payment.created_at limit 1;
    select * into movement from public.cash_movements existing_movement where existing_movement.finance_payment_id = payment.id;
    return jsonb_build_object('obligation', to_jsonb(obligation), 'payment', to_jsonb(payment),
      'movement', to_jsonb(movement), 'idempotent', true);
  end if;

  perform 1
  from public.cash_closures session
  join public.cash_registers register
    on register.id::text = session.register_id
   and register.organization_id = session.organization_id
   and register.branch_id = session.branch_id
  where session.id = p_session_id
    and session.organization_id = p_organization_id
    and session.branch_id = p_branch_id
    and session.date is null
    and register.is_active = true
  for update of session, register;
  if not found then raise exception 'OPEN_CASH_SESSION_NOT_FOUND'; end if;

  insert into public.finance_obligations (
    organization_id, branch_id, category_id, concept, amount, accounting_date, status,
    notes, created_by, updated_by, creation_idempotency_key
  ) values (
    p_organization_id, p_branch_id, p_category_id, concept, p_amount, p_accounting_date, 'pending',
    'Pagado con plata de la caja', p_actor_user_id, p_actor_user_id, creation_key
  ) returning * into obligation;

  insert into public.finance_payments (
    organization_id, branch_id, obligation_id, idempotency_key, direction, amount,
    payment_method, payment_date, cash_session_id, notes, created_by
  ) values (
    p_organization_id, p_branch_id, obligation.id, creation_key, 'payment', p_amount,
    'cash', p_accounting_date, p_session_id, 'Egreso de caja', p_actor_user_id
  ) returning * into payment;

  select * into obligation from public.finance_obligations where id = obligation.id;
  -- El movimiento lo creó el trigger del pago: se devuelve para la pantalla de caja.
  select * into movement from public.cash_movements created_movement where created_movement.finance_payment_id = payment.id;
  return jsonb_build_object('obligation', to_jsonb(obligation), 'payment', to_jsonb(payment),
    'movement', to_jsonb(movement), 'idempotent', false);
end;
$$;

revoke all on function public.server_record_cash_expense_atomic(uuid, uuid, uuid, uuid, numeric, uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.server_record_cash_expense_atomic(uuid, uuid, uuid, uuid, numeric, uuid, text, date, text) to service_role;

-- ─── 5. Seña de una reparación cancelada ─────────────────────────────────────
-- Cancelar antes de «listo» dejaba la seña sin salida: no había forma de
-- devolverla ni de quedársela como ingreso. Se resuelve una sola vez:
--   refund       → se devuelve (efectivo sale de la caja; transferencia no la exige)
--   store_credit → queda como saldo a favor del cliente
--   retain       → el comercio se la queda (cargo por cancelación)
create or replace function public.settle_cancelled_repair_deposit(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_method text default null,
  p_reference text default null,
  p_reason text default null,
  p_cash_session_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_closeout public.repair_closeouts%rowtype;
  deposit numeric(12,2);
  created_credit_id uuid;
  created_closeout_id uuid;
  resolved_method text := nullif(lower(trim(coalesce(p_method, ''))), '');
  operation_time timestamptz := now();
begin
  if p_actor_id is null or not exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'cashier')
  ) then raise exception 'REPAIR_FINANCIAL_PERMISSION_DENIED'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 8 and 120 then
    raise exception 'REPAIR_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_kind not in ('refund', 'store_credit', 'retain') then raise exception 'REPAIR_DEPOSIT_SETTLEMENT_INVALID'; end if;

  select closeout.* into existing_closeout from public.repair_closeouts closeout
  where closeout.organization_id = p_organization_id and closeout.idempotency_key = trim(p_idempotency_key);
  if existing_closeout.id is not null then
    if existing_closeout.repair_id <> p_repair_id then raise exception 'REPAIR_CLOSEOUT_CONFLICT'; end if;
    return jsonb_build_object('repair_id', p_repair_id, 'closeout_id', existing_closeout.id, 'idempotent', true);
  end if;

  select repair.* into target_repair from public.repairs repair
  where repair.id = p_repair_id and repair.organization_id = p_organization_id and repair.branch_id = p_branch_id
  for update;
  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  if target_repair.status <> 'cancelado' then raise exception 'REPAIR_DEPOSIT_REQUIRES_CANCELLED'; end if;
  if exists (select 1 from public.repair_closeouts closeout where closeout.repair_id = p_repair_id and closeout.outcome = 'cancelled') then
    raise exception 'REPAIR_DEPOSIT_ALREADY_SETTLED';
  end if;

  deposit := greatest(0, coalesce(target_repair.paid_amount, 0));
  if deposit <= 0 then raise exception 'REPAIR_HAS_NO_DEPOSIT'; end if;

  if p_kind = 'store_credit' and target_repair.customer_id is null then
    raise exception 'REPAIR_STORE_CREDIT_REQUIRES_CUSTOMER';
  end if;
  if p_kind = 'refund' then
    if resolved_method not in ('cash', 'transfer') then raise exception 'REPAIR_SETTLEMENT_MISMATCH'; end if;
    if resolved_method = 'transfer' and nullif(trim(coalesce(p_reference, '')), '') is null then
      raise exception 'REPAIR_TRANSFER_REFERENCE_REQUIRED';
    end if;
    if resolved_method = 'cash' and (p_cash_session_id is null or not exists (
      select 1 from public.cash_closures closure where closure.id = p_cash_session_id
        and closure.organization_id = p_organization_id and closure.branch_id = p_branch_id and closure.date is null
    )) then raise exception 'REPAIR_CASH_REGISTER_NOT_OPEN'; end if;
  else
    resolved_method := null;
  end if;

  if p_kind = 'refund' and resolved_method = 'cash' then
    insert into public.cash_movements (session_id, type, amount, reason, payment_method, created_by, created_at, organization_id, branch_id)
    values (p_cash_session_id, 'cash_out', deposit,
      'Devolución de seña ' || coalesce(target_repair.ticket_number, p_repair_id::text),
      'cash', p_actor_id, operation_time, p_organization_id, p_branch_id);
  elsif p_kind = 'store_credit' then
    insert into public.customer_store_credits (organization_id, customer_id, amount, reason, source_type, source_id, created_by, created_at)
    values (p_organization_id, target_repair.customer_id, deposit,
      'Saldo a favor por seña de reparación cancelada ' || coalesce(target_repair.ticket_number, p_repair_id::text),
      'repair', p_repair_id, p_actor_id, operation_time)
    returning id into created_credit_id;
  end if;

  insert into public.repair_closeouts (
    organization_id, branch_id, repair_id, outcome, charge_mode, labor_charge, consumed_parts_charge,
    final_charge, paid_before, settlement_kind, settlement_amount, settlement_method, settlement_reference,
    cash_session_id, store_credit_id, reason, parts_resolution, created_by, idempotency_key, created_at
  ) values (
    p_organization_id, p_branch_id, p_repair_id, 'cancelled',
    case when p_kind = 'retain' then 'exceptional' else 'none' end, 0, 0,
    case when p_kind = 'retain' then deposit else 0 end, deposit,
    case when p_kind = 'retain' then 'none' else p_kind end,
    case when p_kind = 'retain' then 0 else deposit end,
    resolved_method, nullif(trim(coalesce(p_reference, '')), ''),
    case when resolved_method = 'cash' then p_cash_session_id else null end,
    created_credit_id, nullif(trim(coalesce(p_reason, '')), ''), '[]'::jsonb, p_actor_id,
    trim(p_idempotency_key), operation_time
  ) returning id into created_closeout_id;

  -- Devuelta o pasada a saldo a favor, la reparación ya no tiene nada cobrado.
  -- Retenida, lo cobrado es el precio final del cargo por cancelación.
  update public.repairs
  set paid_amount = case when p_kind = 'retain' then deposit else 0 end,
      final_cost = case when p_kind = 'retain' then deposit else final_cost end,
      payment_status = case when p_kind = 'retain' then 'pagado' else 'pendiente' end,
      pricing_mode = 'manual',
      updated_at = operation_time
  where id = p_repair_id and organization_id = p_organization_id and branch_id = p_branch_id;

  return jsonb_build_object('repair_id', p_repair_id, 'closeout_id', created_closeout_id,
    'kind', p_kind, 'amount', deposit, 'store_credit_id', created_credit_id, 'idempotent', false);
end;
$$;

revoke all on function public.settle_cancelled_repair_deposit(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.settle_cancelled_repair_deposit(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text) to service_role;

-- ─── 6. Precio estable después de un cierre sin reparar ──────────────────────
-- El cierre fija el precio (el cargo), pero dejaba `pricing_mode='automatic'`:
-- un cobro posterior del saldo recalculaba mano de obra + todos los repuestos
-- (también los devueltos al stock) y el diagnóstico de 30.000 pasaba a 180.000.
create or replace function public.lock_repair_price_after_closeout()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.repairs set pricing_mode = 'manual'
  where id = new.repair_id and organization_id = new.organization_id and pricing_mode <> 'manual';
  return new;
end;
$$;
revoke all on function public.lock_repair_price_after_closeout() from public, anon, authenticated;

drop trigger if exists repair_closeouts_lock_price on public.repair_closeouts;
create trigger repair_closeouts_lock_price after insert on public.repair_closeouts
for each row execute function public.lock_repair_price_after_closeout();

-- Cierres ya hechos: el precio que fijaron no se recalcula más.
update public.repairs repair set pricing_mode = 'manual'
where repair.pricing_mode <> 'manual'
  and exists (select 1 from public.repair_closeouts closeout where closeout.repair_id = repair.id);

-- ─── 7 y 8. Parches puntuales a funciones existentes ─────────────────────────
-- 7. Un servicio (unidad «servicio») se vende en el POS sin turno: no lleva
--    stock. Antes la venta fallaba con BRANCH_INVENTORY_NOT_CONFIGURED.
-- 8. Un cobro o una seña por transferencia no exige caja abierta (como el
--    cierre sin reparar); si hay caja, el movimiento se registra igual.
create or replace function public.pos_item_skips_stock(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.products product
    where product.id = p_product_id and lower(coalesce(product.unit_measure, '')) = 'servicio'
  )
$$;
revoke all on function public.pos_item_skips_stock(uuid) from public, anon, authenticated;

do $migration$
declare
  fn record;
  source text;
  needle text;
  replacement text;
begin
  -- 7. process_pos_sale_atomic_v2: chequeo y descuento de stock.
  select p.oid, pg_get_functiondef(p.oid) as def into fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'process_pos_sale_atomic_v2';
  if fn.def is null then raise exception 'POS_V2_MISSING'; end if;
  source := fn.def;
  -- Ya parcheada (la migración se volvió a correr): no se toca.
  if position('pos_item_skips_stock' in source) = 0 then

  needle := '    select inventory.stock_quantity into branch_stock';
  if position(needle in source) = 0 or position('    unit_price := case' in source) = 0 then
    raise exception 'POS_V2_STOCK_CHECK_CONTRACT_CHANGED';
  end if;
  source := replace(source, needle, '    if not public.pos_item_skips_stock(item.product_id) then' || E'\n' || needle);
  source := replace(source, '    unit_price := case', '    end if;' || E'\n' || '    unit_price := case');

  needle := '    update public.products' || E'\n' || '    set stock_quantity = stock_quantity - item.quantity, updated_at = now()';
  replacement := '    where branch_id = p_branch_id and product_id = item.product_id;' || E'\n' || '  end loop;';
  if position(needle in source) = 0 or position(replacement in source) = 0 then
    raise exception 'POS_V2_STOCK_UPDATE_CONTRACT_CHANGED';
  end if;
  source := replace(source, needle, '    if not public.pos_item_skips_stock(item.product_id) then' || E'\n' || needle);
  source := replace(source, replacement,
    '    where branch_id = p_branch_id and product_id = item.product_id;' || E'\n' || '    end if;' || E'\n' || '  end loop;');
  execute source;
  end if;

  -- 8a. close_repair_and_register_payment: la transferencia no exige caja.
  select p.oid, pg_get_functiondef(p.oid) as def into fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'close_repair_and_register_payment';
  if fn.def is null then raise exception 'REPAIR_PAYMENT_FUNCTION_MISSING'; end if;
  source := fn.def;
  if position('p_payment_method not in (''credit'', ''transfer'')' in source) = 0 then
  needle := '  if resolved_amount > 0 and p_payment_method <> ''credit'' then' || E'\n' || '    if p_cash_session_id is null or not exists (';
  if position(needle in source) = 0 then raise exception 'REPAIR_PAYMENT_CASH_CONTRACT_CHANGED'; end if;
  source := replace(source, needle,
    '  if p_payment_method = ''transfer'' and p_cash_session_id is not null and not exists (' || E'\n' ||
    '    select 1 from public.cash_closures closure where closure.id = p_cash_session_id' || E'\n' ||
    '      and closure.organization_id = p_organization_id and closure.branch_id = p_branch_id and closure.date is null' || E'\n' ||
    '  ) then' || E'\n' ||
    '    p_cash_session_id := null;' || E'\n' ||
    '  end if;' || E'\n' ||
    '  if resolved_amount > 0 and p_payment_method not in (''credit'', ''transfer'') then' || E'\n' ||
    '    if p_cash_session_id is null or not exists (');
  needle := '    if p_payment_method <> ''credit'' then' || E'\n' || '      insert into public.cash_movements (';
  if position(needle in source) = 0 then raise exception 'REPAIR_PAYMENT_MOVEMENT_CONTRACT_CHANGED'; end if;
  source := replace(source, needle,
    '    if p_payment_method <> ''credit'' and p_cash_session_id is not null then' || E'\n' || '      insert into public.cash_movements (');
  execute source;
  end if;

  -- 8b. register_unpriced_repair_deposit: igual para la seña sin precio.
  select p.oid, pg_get_functiondef(p.oid) as def into fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'register_unpriced_repair_deposit';
  if fn.def is null then raise exception 'REPAIR_DEPOSIT_FUNCTION_MISSING'; end if;
  source := fn.def;
  if position('if p_payment_method = ''transfer'' then p_cash_session_id := null;' in source) = 0 then
  needle := '  if p_cash_session_id is null or not exists (' || E'\n' ||
    '    select 1' || E'\n' ||
    '    from public.cash_closures closure' || E'\n' ||
    '    where closure.id = p_cash_session_id' || E'\n' ||
    '      and closure.organization_id = p_organization_id' || E'\n' ||
    '      and closure.branch_id = p_branch_id' || E'\n' ||
    '      and closure.date is null' || E'\n' ||
    '  ) then' || E'\n' ||
    '    raise exception ''REPAIR_CASH_REGISTER_NOT_OPEN'';' || E'\n' ||
    '  end if;';
  if position(needle in source) = 0 then raise exception 'REPAIR_DEPOSIT_CASH_CONTRACT_CHANGED'; end if;
  source := replace(source, needle,
    '  if p_cash_session_id is not null and not exists (' || E'\n' ||
    '    select 1 from public.cash_closures closure where closure.id = p_cash_session_id' || E'\n' ||
    '      and closure.organization_id = p_organization_id and closure.branch_id = p_branch_id and closure.date is null' || E'\n' ||
    '  ) then' || E'\n' ||
    '    if p_payment_method = ''transfer'' then p_cash_session_id := null;' || E'\n' ||
    '    else raise exception ''REPAIR_CASH_REGISTER_NOT_OPEN''; end if;' || E'\n' ||
    '  end if;' || E'\n' ||
    '  if p_cash_session_id is null and p_payment_method <> ''transfer'' then' || E'\n' ||
    '    raise exception ''REPAIR_CASH_REGISTER_NOT_OPEN'';' || E'\n' ||
    '  end if;');
  needle := '  insert into public.cash_movements (' || E'\n' ||
    '    session_id, type, amount, reason, payment_method, created_by,' || E'\n' ||
    '    created_at, organization_id, branch_id' || E'\n' ||
    '  ) values (' || E'\n' ||
    '    p_cash_session_id, ''cash_in'', p_payment_amount,' || E'\n' ||
    '    ''Anticipo reparación '' || coalesce(target_repair.ticket_number, target_repair.id::text),' || E'\n' ||
    '    p_payment_method, p_actor_id, operation_time, p_organization_id, p_branch_id' || E'\n' ||
    '  );';
  if position(needle in source) = 0 then raise exception 'REPAIR_DEPOSIT_MOVEMENT_CONTRACT_CHANGED'; end if;
  source := replace(source, needle, '  if p_cash_session_id is not null then' || E'\n' || needle || E'\n' || '  end if;');
  execute source;
  end if;
end
$migration$;

commit;
