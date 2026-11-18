\set ON_ERROR_STOP on
insert into public.organizations values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.organization_members values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active');
do $$
declare result jsonb; before_count int; begin
 result:=public.create_product_catalog_atomic('{"organization_id":"11111111-1111-4111-8111-111111111111","sku":"COS","has_variants":true,"product_details":{"skin_type":"Mixta"},"initial_batches":[{"sku":"COS-30","expires_on":"2027-01-01","lot_code":"L30"},{"sku":"COS-50","expires_on":"2027-02-01","lot_code":"L50"}]}','[{"sku":"COS-30","stock_quantity":5},{"sku":"COS-50","stock_quantity":3}]','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if (select sum(quantity) from public.product_batches where product_id=(result->>'product_id')::uuid) <> 8 then raise exception 'FAIL: quantity'; end if;
 if (select count(distinct variant_id) from public.product_batches where product_id=(result->>'product_id')::uuid) <> 2 then raise exception 'FAIL: variant lots'; end if;
 if not exists(select 1 from public.product_catalog_details where product_id=(result->>'product_id')::uuid and details->>'skin_type'='Mixta') then raise exception 'FAIL: details'; end if;
 select count(*) into before_count from public.products;
 begin
  perform public.create_product_catalog_atomic('{"organization_id":"11111111-1111-4111-8111-111111111111","sku":"BAD-DATE","has_variants":true,"initial_batches":[{"sku":"BAD","expires_on":"2026-02-31"}]}','[{"sku":"BAD","stock_quantity":5}]','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'FAIL: invalid date accepted';
 exception when datetime_field_overflow then null; end;
 if (select count(*) from public.products) <> before_count then raise exception 'FAIL: rollback'; end if;
 begin
  perform public.create_product_catalog_atomic('{"organization_id":"22222222-2222-4222-8222-222222222222","sku":"CROSS"}','[]',null,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'FAIL: cross org accepted';
 exception when others then if sqlerrm <> 'CATALOG_ACTOR_FORBIDDEN' then raise; end if; end;
 begin
  perform public.create_product_catalog_atomic('{"organization_id":"11111111-1111-4111-8111-111111111111","sku":"BAD-SKU","has_variants":true,"initial_batches":[{"sku":"OTHER","expires_on":"2027-01-01"}]}','[{"sku":"ACTUAL","stock_quantity":5}]','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'FAIL: invalid variant accepted';
 exception when others then if sqlerrm <> 'CATALOG_BATCH_VARIANT_NOT_FOUND' then raise; end if; end;
 if (select count(*) from public.products) <> before_count then raise exception 'FAIL: invalid SKU rollback'; end if;
 if has_function_privilege('authenticated','public.create_product_catalog_atomic(jsonb,jsonb,uuid,uuid)','execute') or has_function_privilege('anon','public.create_product_catalog_atomic(jsonb,jsonb,uuid,uuid)','execute') then raise exception 'FAIL: public RPC'; end if;
 if has_table_privilege('authenticated','public.product_catalog_details','insert') then raise exception 'FAIL: client writes'; end if;
 raise notice 'PASS: variant lots, details, invalid date rollback, tenant, invalid SKU rollback, RPC privileges';
end; $$;
grant select on public.products to authenticated;
set role authenticated;
set test.org='22222222-2222-4222-8222-222222222222';
do $$ begin if exists(select 1 from public.product_catalog_details) then raise exception 'FAIL: RLS'; end if; raise notice 'PASS: cross-tenant RLS'; end; $$;
reset role;
