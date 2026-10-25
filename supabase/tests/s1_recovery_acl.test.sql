-- Run before and after either restrictive recovery. All assertions must remain true.
begin;
select plan(8);
select ok(not has_column_privilege('authenticated','public.products','purchase_price','SELECT'),'product cost denied');
select ok(not has_column_privilege('authenticated','public.products','foreign_purchase_price','SELECT'),'foreign cost denied');
select ok(not has_column_privilege('authenticated','public.product_variants','purchase_price','SELECT'),'variant cost denied');
select ok(has_column_privilege('authenticated','public.products','name','SELECT'),'non-cost product readable');
select ok(not has_table_privilege('authenticated','public.products','TRUNCATE'),'TRUNCATE remains denied');
select ok(not has_function_privilege('anon','public.get_product_costs(uuid[],uuid)','EXECUTE'),'anon cost RPC denied');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.products'::regclass,'public.product_variants'::regclass)),'RLS retained');
select ok(to_regprocedure('public.has_product_cost_access(uuid,text)') is not null,'01 authorization retained');
select * from finish();
rollback;
