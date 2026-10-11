-- Local-only fixtures. All writes roll back, including failures (psql exits).
begin;
insert into public.organizations(id,name,slug,marketplace_public,storefront_public)
values ('11000000-0000-4000-8000-000000000001','Catalog fixture','catalog-fixture-public',true,true),
       ('11000000-0000-4000-8000-000000000002','Private fixture','catalog-fixture-private',false,true);
insert into public.products(id,organization_id,sku,name,sale_price,stock_quantity,is_active,visibility,has_variants)
select ('22000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '11000000-0000-4000-8000-000000000001', 'catalog-fixture-'||i,
 '__catalog_fixture__ product '||i, 100+i, 2, true, 'public', false
from generate_series(1,15) i;
update public.products set has_offer=true,offer_price=50 where id='22000000-0000-4000-8000-000000000015';
insert into public.products(id,organization_id,sku,name,sale_price,stock_quantity,is_active,visibility,has_variants)
values ('22000000-0000-4000-8000-000000000016','11000000-0000-4000-8000-000000000001','catalog-fixture-16','__catalog_fixture__ variants',100,0,true,'public',true),
 ('22000000-0000-4000-8000-000000000017','11000000-0000-4000-8000-000000000002','catalog-fixture-17','__catalog_fixture__ private',1,2,true,'public',false);
insert into public.product_variants(id,product_id,organization_id,variant_name,sale_price,stock_quantity,is_active)
values ('33000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000016','11000000-0000-4000-8000-000000000001','Available',80,3,true),
 ('33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000016','11000000-0000-4000-8000-000000000001','Depleted',1,0,true),
 ('33000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000016','11000000-0000-4000-8000-000000000001','Inactive',2,50,false);
do $test$
declare result jsonb; hidden_order jsonb;
begin
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","sort":"price_asc","limit":12}');
 assert (result->>'total')::int=16, 'public variant-aware total';
 assert jsonb_array_length(result->'rows')=12, 'server page size';
 assert result#>>'{rows,0,product_id}'='22000000-0000-4000-8000-000000000015','discount must sort before pagination';
 assert (result#>>'{rows,1,summary,price}')::numeric=80,'depleted variant must not set minimum';
 assert result#>>'{rows,1,summary,stockQuantity}'='3','stock from active available variants';
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","only_offers":true}');
 assert (result->>'total')::int=1,'global offers filter';
 insert into public.promotions(organization_id,name,code,type,value,public_mode,is_active,applicable_products)
 values ('11000000-0000-4000-8000-000000000001','Fixture promo','fixture-promo','percentage',30,'automatic',true,array['22000000-0000-4000-8000-000000000001']);
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","only_offers":true,"sort":"price_asc"}');
 assert (result->>'total')::int=2,'automatic and manual offers counted globally';
 assert (result#>>'{rows,1,summary,price}')::numeric=71,'automatic rounded price';
 assert result#>>'{rows,1,summary,promotionName}'='Fixture promo','automatic name';
 update public.promotions set min_purchase=1000 where code='fixture-promo';
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","only_offers":true}');
 assert (result->>'total')::int=1,'minimum basket spend is not guaranteed by card';
 update public.promotions set min_purchase=null,end_date=statement_timestamp()-interval '1 day' where code='fixture-promo';
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","only_offers":true}');
 assert (result->>'total')::int=1,'expired automatic promotion ignored';
 update public.products set hide_price=true where id in ('22000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000002');
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","sort":"price_asc","limit":100}');
 hidden_order:=result->'rows';
 assert result#>'{rows,14,summary,price}'='null'::jsonb,'hidden price absent';
 update public.products set sale_price=999999 where id='22000000-0000-4000-8000-000000000001';
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","sort":"price_asc","limit":100}');
 assert result->'rows'=hidden_order,'hidden price cannot alter ranking or summary';
 update public.products set stock_quantity=50 where id='22000000-0000-4000-8000-000000000016';
 update public.product_variants set stock_quantity=0 where product_id='22000000-0000-4000-8000-000000000016';
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__"}');
 assert (result->>'total')::int=15,'parent stock is not fallback for depleted variants';
 result:=public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__","offset":1000}');
 assert (result->>'total')::int=15 and result->'rows'='[]'::jsonb,'out-of-range retains total';
 assert not has_function_privilege('anon','public.get_marketplace_effective_catalog(jsonb)','EXECUTE'),'anon forbidden';
 assert not has_function_privilege('authenticated','public.get_marketplace_effective_catalog(jsonb)','EXECUTE'),'authenticated forbidden';
 assert has_function_privilege('service_role','public.get_marketplace_effective_catalog(jsonb)','EXECUTE'),'service role allowed';
end
$test$;
set local role service_role;
select (public.get_marketplace_effective_catalog('{"q":"__catalog_fixture__"}')->>'total')::int=15 as service_role_read;
rollback;
