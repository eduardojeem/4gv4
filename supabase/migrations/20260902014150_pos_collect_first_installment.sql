-- Depends on 20260902010235_credit_first_installment_timing.sql.
-- No historical rows are modified. Everything runs inside the existing POS transaction.
begin;

create or replace function public.collect_pos_first_installment(
  p_organization_id uuid, p_branch_id uuid, p_actor_id uuid,
  p_session_id uuid, p_credit_id uuid, p_payment jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  credit public.customer_credits%rowtype;
  installment public.credit_installments%rowtype;
  method text := p_payment->>'method';
  bank text := nullif(trim(p_payment->>'bank'), '');
  reference text := nullif(trim(p_payment->>'reference'), '');
  received numeric;
  payment_id uuid;
begin
  if p_payment is null or p_payment = 'null'::jsonb then return; end if;
  if jsonb_typeof(p_payment) <> 'object' or method is null or method not in ('cash', 'transfer') then
    raise exception 'INVALID_FIRST_INSTALLMENT_PAYMENT';
  end if;
  if not exists (select 1 from public.organization_members m where m.organization_id = p_organization_id
    and m.user_id = p_actor_id and m.status = 'active' and m.role in ('owner','admin','manager','cashier','technician','seller')) then
    raise exception 'POS_PERMISSION_DENIED';
  end if;
  select * into credit from public.customer_credits c where c.id = p_credit_id
    and c.organization_id = p_organization_id and c.branch_id = p_branch_id for update;
  if not found then raise exception 'INVALID_FIRST_INSTALLMENT_PAYMENT'; end if;
  if credit.metadata->'first_installment_payment' is not null then return; end if;
  if credit.metadata->>'first_installment_timing' is distinct from 'at_start' then
    raise exception 'FIRST_INSTALLMENT_REQUIRES_START';
  end if;
  perform 1 from public.cash_closures c where c.id = p_session_id and c.organization_id = p_organization_id
    and c.branch_id = p_branch_id and c.date is null for update;
  if not found then raise exception 'CASH_REGISTER_NOT_OPEN'; end if;
  select * into installment from public.credit_installments i where i.credit_id = p_credit_id
    and i.installment_number = 1 for update;
  if not found or installment.amount <= 0 or coalesce(installment.amount_paid,0) <> 0
    or installment.status = 'paid' then raise exception 'INVALID_FIRST_INSTALLMENT_PAYMENT'; end if;
  if method = 'transfer' then
    if bank is null or reference is null or length(bank) > 120 or length(reference) > 120 then
      raise exception 'FIRST_INSTALLMENT_TRANSFER_REQUIRED';
    end if;
  else
    received := (p_payment->>'cashReceived')::numeric;
    if received is null or received::text in ('NaN','Infinity','-Infinity') or received < installment.amount then
      raise exception 'FIRST_INSTALLMENT_CASH_INSUFFICIENT';
    end if;
  end if;
  insert into public.credit_payments (credit_id, installment_id, amount, payment_method, notes)
  values (credit.id, installment.id, installment.amount, method,
    'Primera cuota cobrada al generar crédito. Venta ' || credit.sale_id::text ||
    case when method = 'transfer' then '. Banco/cuenta: ' || bank || '. Referencia: ' || reference else '' end)
  returning id into payment_id;
  -- The existing payment trigger is the canonical updater of installment/credit status.
  if not exists (select 1 from public.credit_installments i where i.id = installment.id
    and i.status = 'paid' and i.amount_paid = i.amount) then
    raise exception 'CREDIT_PAYMENT_TRIGGER_REQUIRED';
  end if;
  if method = 'cash' then
    insert into public.cash_movements (session_id, type, amount, reason, payment_method, created_by, created_at, organization_id, branch_id)
    values (p_session_id, 'cash_in', installment.amount, 'Cobro primera cuota crédito ' || credit.id::text,
      'cash', p_actor_id, now(), p_organization_id, p_branch_id);
  end if;
  update public.customer_credits set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'first_installment_payment', jsonb_build_object('amount', installment.amount, 'method', method,
      'bank', bank, 'reference', reference, 'cashReceived', received,
      'change', case when method = 'cash' then received - installment.amount else 0 end,
      'paymentId', payment_id, 'actorId', p_actor_id, 'sessionId', p_session_id)) where id = credit.id;
end $$;

create or replace function public.pos_credit_checkout_summary(p_organization_id uuid, p_sale_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'firstInstallmentTiming', c.metadata->>'first_installment_timing',
    'startDate', to_char(c.start_date at time zone 'America/Asuncion','YYYY-MM-DD'),
    'frequency', c.metadata->>'frequency',
    'firstPayment', c.metadata->'first_installment_payment',
    'firstPaymentAmount', coalesce((c.metadata->'first_installment_payment'->>'amount')::numeric,0),
    'remainingBalance', c.principal - coalesce((c.metadata->'first_installment_payment'->>'amount')::numeric,0),
    'installments', (select jsonb_agg(jsonb_build_object('number',i.installment_number,
      'dueDate',to_char(i.due_date at time zone 'America/Asuncion','YYYY-MM-DD'),
      'amount',i.amount,'amountPaid',coalesce(i.amount_paid,0),'status',i.status) order by i.installment_number)
      from public.credit_installments i where i.credit_id = c.id)
  ) from public.customer_credits c where c.sale_id = p_sale_id and c.organization_id = p_organization_id limit 1;
$$;

revoke all on function public.collect_pos_first_installment(uuid,uuid,uuid,uuid,uuid,jsonb) from public;
revoke all on function public.pos_credit_checkout_summary(uuid,uuid) from public;
grant execute on function public.collect_pos_first_installment(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.pos_credit_checkout_summary(uuid,uuid) to service_role;

do $migration$
declare
  target regprocedure := 'public.process_pos_sale_atomic_v2(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text)'::regprocedure;
  definition text := pg_get_functiondef(target);
  marker text := 'return jsonb_build_object(' || chr(10) || '    ''sale_id'', created_sale_id,';
  from_pos integer;
  end_pos integer;
begin
  definition := replace(definition, chr(13), '');
  if strpos(definition, 'collect_pos_first_installment(') > 0 then return; end if;
  if strpos(definition, 'credit_schedule_due_date(') = 0 then raise exception 'Apply credit_first_installment_timing first'; end if;
  if strpos(definition, marker) = 0 then raise exception 'POS result marker missing'; end if;
  definition := replace(definition, marker, $call$if p_credit->'first_payment' is not null and p_credit->'first_payment' <> 'null'::jsonb then
    if created_credit_id is null then raise exception 'INVALID_FIRST_INSTALLMENT_PAYMENT'; end if;
    perform public.collect_pos_first_installment(p_organization_id,p_branch_id,p_actor_id,p_session_id,created_credit_id,p_credit->'first_payment');
  end if;
  $call$ || marker);
  from_pos := strpos(definition, '''credit_schedule'', case when created_credit_id is not null');
  if from_pos = 0 then raise exception 'POS schedule result missing'; end if;
  end_pos := strpos(substr(definition,from_pos), ') else null end');
  if end_pos = 0 then raise exception 'POS schedule result end missing'; end if;
  definition := overlay(definition placing '''credit_schedule'', public.pos_credit_checkout_summary(p_organization_id,created_sale_id)' from from_pos for end_pos + length(') else null end') - 1);
  if strpos(definition, 'return jsonb_build_object(''sale_id'', existing_sale_id, ''idempotent'', true);') = 0 then
    raise exception 'POS idempotency result missing';
  end if;
  definition := replace(definition,
    'return jsonb_build_object(''sale_id'', existing_sale_id, ''idempotent'', true);',
    'return jsonb_build_object(''sale_id'', existing_sale_id, ''idempotent'', true, ''credit_schedule'', public.pos_credit_checkout_summary(p_organization_id,existing_sale_id));');
  execute definition;
end $migration$;

create or replace function public.pos_first_installment_payment_version()
returns integer language sql immutable security invoker as $$ select 1 $$;
revoke all on function public.pos_first_installment_payment_version() from public;
grant execute on function public.pos_first_installment_payment_version() to service_role;
notify pgrst, 'reload schema';
commit;
