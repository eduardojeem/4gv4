-- The extended overload has three trailing default arguments. Calling the
-- original 17-argument function from its body is therefore ambiguous in
-- PostgreSQL because both overloads accept the same 17 supplied arguments.
-- Give the public application entrypoint a distinct name and leave the base
-- function in place for the delegated transactional closure.

alter function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text, numeric, integer, text
) rename to close_repair_and_register_payment_v2;

revoke all on function public.close_repair_and_register_payment_v2(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text, numeric, integer, text
) from public, anon, authenticated;

grant execute on function public.close_repair_and_register_payment_v2(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text, numeric, integer, text
) to service_role;

notify pgrst, 'reload schema';

