// Local PostgreSQL only: no environment file, network or production client.
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { createRequire } = require('node:module')
const assert = require('node:assert/strict')
const { PGlite } = createRequire(resolve(process.argv[2] || 'package.json'))('@electric-sql/pglite')
const ORG='00000000-0000-4000-8000-000000000001', ACTOR='00000000-0000-4000-8000-000000000002', BRANCH='00000000-0000-4000-8000-000000000003'
const CUSTOMER='00000000-0000-4000-8000-000000000004', SALE='00000000-0000-4000-8000-000000000005', ITEM='00000000-0000-4000-8000-000000000006', PRODUCT='00000000-0000-4000-8000-000000000007'
const CASE='00000000-0000-4000-8000-000000000008'
async function main() {
 const db=new PGlite()
 try {
 await db.exec(readFileSync('scripts/fixtures/dashboard-financial-schema.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261009015709_cash_actor_jwt_claims_compatibility.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261016214756_dashboard_financial_atomic_hardening.sql','utf8'))
 await db.exec("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
 await db.exec("insert into organizations values('"+ORG+"'); insert into organization_members values('"+ORG+"','"+ACTOR+"','active','admin'); insert into branches(id,organization_id,is_active) values('"+BRANCH+"','"+ORG+"',true); insert into customers values('"+CUSTOMER+"','"+ORG+"'); insert into products(id,organization_id,stock_quantity) values('"+PRODUCT+"','"+ORG+"',10); insert into sales values('"+SALE+"','"+ORG+"','"+BRANCH+"','"+CUSTOMER+"',100,80,'completed'); insert into sale_items(id,sale_id,organization_id,product_id,quantity,subtotal) values('"+ITEM+"','"+SALE+"','"+ORG+"','"+PRODUCT+"',1,100); insert into after_sales_cases(id,organization_id,source_type,request_type,status,sale_id,sale_item_id,customer_id,product_id,quantity,reason,refund_amount) values('"+CASE+"','"+ORG+"','sale','return','approved','"+SALE+"','"+ITEM+"','"+CUSTOMER+"','"+PRODUCT+"',1,'Fixture',500)")
 const scalar=async sql=>(await db.query(sql)).rows[0]
 const call=async input=>(await db.query('select public.server_resolve_after_sales_case_atomic($1,$2,$3,$4) result',[ACTOR,ORG,CASE,input])).rows[0].result
 await assert.rejects(call({status:'completed',refund_method:'store_credit',restock_action:'sellable'}),/AFTER_SALES_REFUND_EXCEEDS_CAP/)
 assert.equal((await scalar('select stock_quantity from products')).stock_quantity,10)
 await assert.rejects(call({status:'completed',refund_amount:50,restock_action:'sellable'}),/AFTER_SALES_REFUND_METHOD_REQUIRED/)
 await assert.rejects(call({status:'completed',refund_amount:50,refund_method:'cash',restock_action:'sellable'}),/OPEN_CASH_SESSION_NOT_FOUND/)
 assert.equal((await scalar('select stock_quantity from products')).stock_quantity,10)
 await db.exec("create function fail_resolution() returns trigger language plpgsql as $$begin if new.status='completed' then raise exception 'TEST_FINAL_WRITE_FAILURE'; end if; return new; end$$; create trigger fail_resolution before update on after_sales_cases for each row execute function fail_resolution()")
 await assert.rejects(call({status:'completed',refund_amount:50,refund_method:'store_credit',restock_action:'sellable'}),/TEST_FINAL_WRITE_FAILURE/)
 assert.equal((await scalar('select stock_quantity from products')).stock_quantity,10)
 assert.equal((await scalar('select count(*)::int n from customer_store_credits')).n,0)
 await db.exec('drop trigger fail_resolution on after_sales_cases')
 const input={status:'completed',refund_amount:50,refund_method:'store_credit',restock_action:'sellable'}
 const first=await call(input), retry=await call(input)
 assert.equal(first.data.status,'completed'); assert.equal(retry.replayed,true)
 assert.equal((await scalar('select stock_quantity from products')).stock_quantity,11)
 assert.equal((await scalar('select count(*)::int n from customer_store_credits')).n,1)
 await assert.rejects(call({...input,refund_amount:60}),/AFTER_SALES_ALREADY_RESOLVED/)
 await assert.rejects(db.query('select public.server_resolve_after_sales_case_atomic($1,$2,$3,$4)',[ACTOR,'00000000-0000-4000-8000-000000000099',CASE,input]),/AFTER_SALES_FORBIDDEN|AFTER_SALES_NOT_FOUND/)
 // Test partial returns against integer quantities, not a numeric-only fixture.
 await db.exec('update sale_items set quantity=2,subtotal=100; update sales set total_amount=100');
 const create=async input=>(await db.query('select public.server_create_after_sales_case_atomic($1,$2,$3) result',[ACTOR,ORG,input])).rows[0].result;
 const createInput={source_type:'sale',request_type:'return',sale_id:SALE,sale_item_id:ITEM,quantity:1,reason:'Partial return',refund_amount:50};
 await assert.rejects(create({...createInput,refund_amount:51}),/AFTER_SALES_REFUND_EXCEEDS_CAP/);
 await assert.rejects(create({...createInput,product_id:CUSTOMER}),/AFTER_SALES_INVALID_PRODUCT/);
 const partial=await create(createInput);
 assert.equal(partial.data.product_id,PRODUCT);assert.equal(partial.data.customer_id,CUSTOMER);
 const resolveCase=async (caseId,input)=>(await db.query('select public.server_resolve_after_sales_case_atomic($1,$2,$3,$4) result',[ACTOR,ORG,caseId,input])).rows[0].result;
 await resolveCase(partial.data.id,{status:'approved'});
 await resolveCase(partial.data.id,{status:'completed',refund_amount:50,refund_method:'store_credit',restock_action:'none'});
 await assert.rejects(create(createInput),/AFTER_SALES_QUANTITY_EXCEEDED/);
 const repair='00000000-0000-4000-8000-000000000010';
 await db.query("insert into repairs(id,organization_id,branch_id,customer_id,device_brand,device_model,final_cost) values($1,$2,$3,$4,'Test','Phone',100)",[repair,ORG,BRANCH,CUSTOMER]);
 const warranty=await create({source_type:'repair',request_type:'repair_warranty',repair_id:repair,reason:'Warranty'});
 const approved=await resolveCase(warranty.data.id,{status:'approved'});
 assert.ok(approved.data.generated_repair_id);
 assert.equal((await resolveCase(warranty.data.id,{status:'approved'})).replayed,true);
 assert.equal((await scalar('select count(*)::int n from repairs')).n,2);
 await resolveCase(warranty.data.id,{status:'completed',refund_amount:60,refund_method:'store_credit',restock_action:'none'});
 const warranty2=await create({source_type:'repair',request_type:'repair_warranty',repair_id:repair,reason:'Second warranty'});
 await resolveCase(warranty2.data.id,{status:'approved'});
 await assert.rejects(resolveCase(warranty2.data.id,{status:'completed',refund_amount:60,refund_method:'store_credit',restock_action:'none'}),/AFTER_SALES_REFUND_EXCEEDS_CAP/);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated'})]);
 await assert.rejects(call(input),/SERVICE_ROLE_REQUIRED/);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role'})]);
 const permissions=await scalar("select has_table_privilege('authenticated','cash_movements','INSERT') ins,has_table_privilege('authenticated','cash_movements','UPDATE') upd,has_table_privilege('authenticated','cash_movements','DELETE') del,has_function_privilege('authenticated','public.server_resolve_after_sales_case_atomic(uuid,uuid,uuid,jsonb)','EXECUTE') rpc")
 assert.deepEqual(permissions,{ins:false,upd:false,del:false,rpc:false})
 await db.exec("insert into cash_movements(organization_id,branch_id,type,amount) values('"+ORG+"','"+BRANCH+"','cash_in',1); insert into cash_movements(organization_id,branch_id,type,amount,finance_payment_id) values('"+ORG+"','"+BRANCH+"','cash_out',2,gen_random_uuid())")
 await db.exec("select set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\""+ACTOR+"\"}',false); select set_config('request.jwt.claim.sub','"+ACTOR+"',false); set role authenticated")
 assert.equal((await scalar('select count(*)::int n from cash_movements')).n,1)
 await assert.rejects(db.exec("insert into cash_movements(type,amount) values('cash_in',99)"),/permission denied/)
 await db.exec("reset role; select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
 await assert.rejects(db.exec("update sales set status='cancelled'"),/SALE_HAS_COMPLETED_AFTER_SALES/);
 await db.query('insert into cash_closures(id,organization_id,branch_id) values($1,$2,$3)',[CASE,ORG,BRANCH]);
 await resolveCase(warranty2.data.id,{refund_amount:40,refund_method:'cash',restock_action:'none'});
 await resolveCase(warranty2.data.id,{refund_amount:30});
 await resolveCase(warranty2.data.id,{refund_amount:40});
 const cashResult=await resolveCase(warranty2.data.id,{status:'completed'});
 assert.equal(cashResult.refund.amount,40);
 assert.equal((await scalar("select created_by from cash_movements where amount=40")).created_by,ACTOR);
 for (const role of ['anon','authenticated']) {
   for (const table of ['cash_movements','after_sales_cases','after_sales_resolution_requests']) {
     for (const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE']) {
       assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,table,privilege])).rows[0].allowed,false);
     }
   }
 }
 console.log('PASS: create/source checks, partial quantities, warranty replay and cumulative cap, service guard; refund cap incl. stored amount and invoice discount; prevalidation; failed-final-write rollback; replay exactly once; changed retry conflict; tenant isolation; cash direct-write revocation; restrictive financial visibility.')
 } finally { await db.close() }
}
main().catch(error=>{console.error(error.message, error.where || '');process.exitCode=1})
