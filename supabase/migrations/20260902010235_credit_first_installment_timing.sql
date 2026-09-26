-- Apply before deploying the new checkout. No existing credit rows are changed.
begin;

create or replace function public.credit_schedule_due_date(
  p_start_date date, p_index integer, p_frequency text, p_timing text
) returns date language plpgsql immutable security invoker set search_path = public as $$
declare
  cycle_index integer;
begin
  if p_start_date is null or p_index is null or p_index < 0
    or p_frequency is null or p_frequency not in ('weekly', 'biweekly', 'monthly')
    or p_timing is null or p_timing not in ('at_start', 'next_cycle') then
    raise exception 'INVALID_CREDIT_SCHEDULE';
  end if;
  cycle_index := p_index + case when p_timing = 'next_cycle' then 1 else 0 end;
  return case p_frequency
    when 'weekly' then p_start_date + 7 * cycle_index
    when 'biweekly' then p_start_date + 15 * cycle_index
    else (p_start_date + make_interval(months => cycle_index))::date
  end;
end $$;
revoke all on function public.credit_schedule_due_date(date,integer,text,text) from public;
grant execute on function public.credit_schedule_due_date(date,integer,text,text) to service_role;

-- Patch the active function in place, retaining all subsequent security/stock
-- changes and the v3/v4 transaction/idempotency wrappers. Fail atomically on drift.
do $migration$
declare
  target regprocedure := 'public.process_pos_sale_atomic_v2(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text)'::regprocedure;
  definition text := pg_get_functiondef(target);
  original text;
  from_pos integer;
  to_pos integer;
begin
  if strpos(definition, 'credit_schedule_due_date(') > 0 then return; end if;
  original := definition;
  from_pos := strpos(definition, 'installment_due := case credit_frequency');
  if from_pos = 0 then raise exception 'POS credit schedule block not found; migration not applied'; end if;
  to_pos := strpos(substr(definition, from_pos), 'end;');
  if to_pos = 0 then raise exception 'POS credit schedule end not found'; end if;
  definition := overlay(definition placing $replacement$installment_due := public.credit_schedule_due_date(
        (now() at time zone 'America/Asuncion')::date,
        installment_index - 1, credit_frequency,
        coalesce(p_credit->>'first_installment_timing', 'at_start')
      )::timestamp at time zone 'America/Asuncion';$replacement$ from from_pos for to_pos + 3);

  if strpos(definition, '''product_financing'', ''sale'', ''Venta '' || trim(p_code), ''{}''::jsonb') = 0 then
    raise exception 'POS credit metadata block not found';
  end if;
  definition := replace(definition,
    '''product_financing'', ''sale'', ''Venta '' || trim(p_code), ''{}''::jsonb',
    '''product_financing'', ''sale'', ''Venta '' || trim(p_code), jsonb_build_object(''first_installment_timing'', coalesce(p_credit->>''first_installment_timing'', ''at_start''), ''frequency'', credit_frequency)');

  -- Match the shared TS allocator: split principal and interest independently,
  -- with the currency remainder in the last installment (PYG has no cents).
  if strpos(definition, 'financed_total := round(credit_base * (1 + credit_rate / 100), 2);') = 0
    or strpos(definition, 'installment_base := trunc((financed_total / credit_count) * 100) / 100;') = 0 then
    raise exception 'POS credit rounding block not found';
  end if;
  definition := replace(definition, 'financed_total := round(credit_base * (1 + credit_rate / 100), 2);',
    'credit_base := round(credit_base, coalesce((p_credit->>''fraction_digits'')::integer, 0)); financed_total := credit_base + round(credit_base * credit_rate / 100, coalesce((p_credit->>''fraction_digits'')::integer, 0));');
  definition := replace(definition, 'installment_base := trunc((financed_total / credit_count) * 100) / 100;',
    'installment_base := trunc(credit_base / credit_count, coalesce((p_credit->>''fraction_digits'')::integer, 0)) + trunc((financed_total - credit_base) / credit_count, coalesce((p_credit->>''fraction_digits'')::integer, 0));');
  definition := replace(definition, 'principal_base := trunc((credit_base / credit_count) * 100) / 100;',
    'principal_base := trunc(credit_base / credit_count, coalesce((p_credit->>''fraction_digits'')::integer, 0));');

  -- Guard callers that bypass the API as well; no stale confirmation is saved.
  definition := replace(definition, 'credit_rate := least(', $guard$if p_credit->>'start_date' is not null
      and (p_credit->>'start_date')::date <> (now() at time zone 'America/Asuncion')::date then
      raise exception 'CREDIT_START_DATE_CHANGED';
    end if;
    credit_rate := least($guard$);

  if strpos(definition, '''credit_id'', created_credit_id') = 0 then raise exception 'POS credit result block not found'; end if;
  definition := replace(definition, '''credit_id'', created_credit_id', $result$'credit_id', created_credit_id,
    'credit_schedule', case when created_credit_id is not null then jsonb_build_object(
      'firstInstallmentTiming', coalesce(p_credit->>'first_installment_timing', 'at_start'),
      'startDate', to_char(now() at time zone 'America/Asuncion', 'YYYY-MM-DD'),
      'frequency', credit_frequency,
      'installments', (select jsonb_agg(jsonb_build_object('number', i.installment_number,
        'dueDate', to_char(i.due_date at time zone 'America/Asuncion', 'YYYY-MM-DD'), 'amount', i.amount)
        order by i.installment_number) from public.credit_installments i where i.credit_id = created_credit_id)
    ) else null end$result$);
  if definition = original then raise exception 'POS credit schedule unchanged'; end if;
  execute definition;
end $migration$;

notify pgrst, 'reload schema';
commit;
