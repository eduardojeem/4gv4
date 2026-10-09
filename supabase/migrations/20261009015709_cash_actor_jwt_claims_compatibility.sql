-- PostgREST supplies JWT claims as JSON; retain support for older request GUCs.
-- Replace only the guard, keeping the server-only RPCs and actor propagation.
begin;

create or replace function public.assert_service_cash_actor(p_actor_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_role text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
  if v_role <> 'service_role' then
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

commit;
