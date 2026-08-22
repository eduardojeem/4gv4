-- Keep the persisted POS installment calendar aligned with the checkout and
-- receipt rule: a biweekly installment is due every 15 calendar days.
-- Rebuild the current function definition in place so the v3/v4 wrappers keep
-- their existing security, validation and repair-payment behavior.
do $migration$
declare
  function_oid regprocedure := 'public.process_pos_sale_atomic_v2(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,text,numeric,text,numeric,boolean,jsonb,jsonb,boolean,text)'::regprocedure;
  current_definition text;
  updated_definition text;
begin
  current_definition := pg_get_functiondef(function_oid);
  updated_definition := replace(
    current_definition,
    'make_interval(days => 14 * installment_index)',
    'make_interval(days => 15 * installment_index)'
  );

  if updated_definition = current_definition then
    raise exception 'Expected POS biweekly installment expression was not found';
  end if;

  execute updated_definition;
end
$migration$;
