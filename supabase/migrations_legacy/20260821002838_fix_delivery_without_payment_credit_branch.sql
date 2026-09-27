-- A delivery with no new payment sends p_payment_method = null. SQL's
-- `null <> 'credit'` is unknown, so the wrapper incorrectly entered the credit
-- branch and raised REPAIR_CREDIT_TERMS_INVALID. Patch the established wrapper
-- while preserving its complete, previously audited implementation.
do $$
declare
  function_definition text;
  old_condition constant text := 'if p_payment_method <> ''credit'' then';
  new_condition constant text := 'if p_payment_method is distinct from ''credit'' then';
begin
  select pg_get_functiondef(
    'public.close_repair_and_register_payment_v2(uuid,uuid,uuid,uuid,boolean,text,text,boolean,text,numeric,text,text,text,uuid,uuid,uuid,text,numeric,integer,text)'::regprocedure
  ) into function_definition;

  -- Re-running migrations during local resets or manual recovery must be safe.
  if position(new_condition in function_definition) > 0 then
    return;
  end if;

  if position(old_condition in function_definition) = 0 then
    raise exception 'Expected credit branch condition was not found';
  end if;

  execute replace(function_definition, old_condition, new_condition);
end;
$$;
