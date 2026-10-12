-- TEST CLEANUP ONLY, never a migration or a production script.
begin;
do $$ begin
 if not exists(select 1 from public.organizations where id='cf160000-0000-4000-8000-000000000001' and slug='credit-financial-consumer-fixture') then raise exception 'Fixture identity mismatch'; end if;
end $$;
-- Supabase's administrative SET hook permits SET, not set_config().
set local session_replication_role=replica;
do $$ declare t record; begin
 delete from public.credit_installments where credit_id in(select id from public.customer_credits where organization_id='cf160000-0000-4000-8000-000000000001');
 delete from public.branch_inventory where branch_id='cf360000-0000-4000-8000-000000000001' and product_id='cf460000-0000-4000-8000-000000000001';
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='organization_id' and table_name in(select tablename from pg_tables where schemaname='public') loop
  execute format('delete from public.%I where organization_id=$1',t.table_name) using 'cf160000-0000-4000-8000-000000000001'::uuid;
 end loop;
 delete from public.organizations where id='cf160000-0000-4000-8000-000000000001' and slug='credit-financial-consumer-fixture';
 delete from public.profiles where id='cf060000-0000-4000-8000-000000000001';
 delete from auth.users where id='cf060000-0000-4000-8000-000000000001';
end $$;
commit;
