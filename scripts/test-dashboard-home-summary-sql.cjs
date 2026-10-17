const { PGlite } = require('@electric-sql/pglite')
const { readFileSync } = require('node:fs')
const assert = require('node:assert/strict')
const ORG='00000000-0000-4000-8000-000000000001', OTHER='00000000-0000-4000-8000-000000000002', BRANCH='00000000-0000-4000-8000-000000000003', BRANCH2='00000000-0000-4000-8000-000000000004'
async function main() {
 const db = new PGlite()
 try {
 await db.exec(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table organizations(id uuid primary key);
 create table organization_members(organization_id uuid,user_id uuid,status text);
 create function public.user_has_branch_access(target_branch_id uuid,user_uuid uuid) returns boolean language sql stable as $$select nullif(current_setting('test.allowed_branch',true),'') is null or target_branch_id=nullif(current_setting('test.allowed_branch',true),'')::uuid$$;
 create table branches(id uuid primary key,organization_id uuid,is_active boolean default true);
 create table organization_settings(organization_id uuid,timezone text);
 create table sales(id int,organization_id uuid,branch_id uuid,created_at timestamptz,status text,total_amount numeric);
 create table customers(id int,organization_id uuid,created_at timestamptz);
 create table categories(id int,organization_id uuid,name text,is_active boolean);
 create table products(id int,organization_id uuid,category_id int,unit_measure text,stock_quantity numeric,min_stock numeric,is_active boolean);
 create table customer_orders(id int,organization_id uuid,branch_id uuid,status text);
 create table repairs(id int,organization_id uuid,branch_id uuid,status text,created_at timestamptz,delivered_at timestamptz,final_cost numeric,estimated_cost numeric,paid_amount numeric);
 grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;
 grant select on all tables in schema public to authenticated;
 insert into organizations values('${ORG}'),('${OTHER}');
 insert into organization_members values('${ORG}','${ORG}','active'),('${OTHER}','${ORG}','suspended');
 insert into branches values('${BRANCH}','${ORG}',true),('${BRANCH2}','${ORG}',true);
 insert into organization_settings values('${ORG}','America/Asuncion');
 select set_config('test.uid','${ORG}',false); select set_config('test.org','${ORG}',false);
 `)
 for (const table of ['organization_members','organizations','branches','organization_settings','sales','customers','categories','products','customer_orders','repairs']) {
  await db.exec(`alter table ${table} enable row level security; create policy tenant on ${table} to authenticated using (${table==='organization_members'?"user_id=auth.uid()":table==='organizations'||table==='products'?'true':"organization_id=current_setting('test.org')::uuid"})`)
 }
 await db.exec(readFileSync('supabase/migrations/20261017213627_dashboard_home_summary.sql','utf8'))
 await db.exec(`insert into sales select n,'${ORG}','${BRANCH}',now(),'completed',10 from generate_series(1,1250)n;
 insert into sales values(1251,'${ORG}','${BRANCH2}',now(),'completed',999),(1252,'${OTHER}',null,now(),'completed',888),(1253,'${ORG}','${BRANCH}',now(),'cancelled',500);
 insert into sales values(1254,'${ORG}',null,now(),'completed',5);
 insert into customers values(1,'${ORG}',now());
 insert into categories values(1,'${ORG}','Servicio técnico',true);
 insert into products values(1,'${ORG}',null,'unidad',3,null,true),(2,'${ORG}',1,'unidad',0,5,true),(3,'${ORG}',null,'SERVICIO',0,5,true),(4,'${ORG}',null,'unidad',8,2,true);
 insert into customer_orders values(1,'${ORG}','${BRANCH}','PENDING'),(2,'${ORG}','${BRANCH2}','PENDING'),(3,'${ORG}',null,'PENDING');
 insert into repairs values(1,'${ORG}','${BRANCH}','entregado',now(),now(),0,900,0),(2,'${ORG}','${BRANCH}','listo',now(),null,null,100,0),(3,'${ORG}','${BRANCH}','pausado',now(),null,null,50,0),(4,'${ORG}','${BRANCH2}','pausado',now(),null,null,777,0),(5,'${ORG}',null,'listo',now(),null,null,20,0);
 set role authenticated;`)
 const call=async branch=>(await db.query('select public.dashboard_home_summary($1,$2) result',[ORG,branch])).rows[0].result
 const result=await call(BRANCH)
 assert.equal(result.sales.todayAmount,12500); assert.equal(result.sales.todayCount,1250)
 assert.equal(result.sales.daily.length,7); assert.equal(result.customers.daily.length,7)
 assert.equal(result.sales.daily.reduce((a,b)=>a+b,0),12500)
 assert.deepEqual(result.catalog,{physicalCount:2,servicesCount:2,lowStockCount:1})
 assert.equal(result.repairs.deliveredAmount,0); assert.equal(result.repairs.readyAmount,100); assert.equal(result.repairs.activeCount,1)
 assert.ok(JSON.stringify(result).length<2000)
 assert.equal((await call(null)).sales.todayAmount,13504)
 await db.exec(`reset role; update organization_settings set timezone='Asia/Tokyo';
 insert into sales values(1260,'${ORG}','${BRANCH}',(((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo')+interval '1 minute','completed',7),
 (1261,'${ORG}','${BRANCH}',(((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo')-interval '1 millisecond','completed',9999),
 (1262,'${ORG}','${BRANCH}',((((now() at time zone 'Asia/Tokyo')::date)+1)::timestamp at time zone 'Asia/Tokyo'),'completed',9999);set role authenticated;`)
 const tokyo=await call(BRANCH)
 assert.equal(tokyo.timeZone,'Asia/Tokyo');assert.equal(tokyo.sales.todayAmount,12507)
 assert.equal(tokyo.sales.todayCount,1251)

 await assert.rejects(db.query('select public.dashboard_home_summary($1,null)',[OTHER]),/DASHBOARD_ORGANIZATION_FORBIDDEN/)
 await db.exec("select set_config('test.allowed_branch','"+BRANCH+"',false)")
 await assert.rejects(call(BRANCH2),/DASHBOARD_BRANCH_FORBIDDEN/)
 const allowedAll=await call(null)
 assert.equal(allowedAll.sales.todayAmount,12512,'all must exclude unassigned branch sales but retain org-RLS legacy branchless sales')
 assert.equal(allowedAll.repairs.activeCount,1,'all must exclude unassigned branch repairs')
 assert.equal(allowedAll.repairs.readyAmount,120,'all retains tenant-visible legacy branchless repairs')
 assert.equal(allowedAll.orders.activeCount,2,'all excludes unassigned branch orders and retains branchless legacy orders')
 await db.exec("select set_config('test.allowed_branch','',false)")
 const flags=(await db.query("select public.dashboard_home_summary($1,$2,array[]::text[]) result",[ORG,BRANCH])).rows[0].result
 assert.equal(flags.repairs.activeCount,0); assert.equal(flags.catalog.physicalCount,0)
 await db.exec('reset role; delete from sales; set role authenticated')
 assert.equal((await call(BRANCH)).sales.todayAmount,0)
 await db.exec("select set_config('test.uid','',false)")
 await assert.rejects(call(BRANCH),/DASHBOARD_AUTH_REQUIRED/)
 assert.equal((await db.query("select prosecdef from pg_proc where proname='dashboard_home_summary'")).rows[0].prosecdef,false)
 console.log('PASS dashboard_home_summary: 1250 sales, bounded payload, RLS, branch, modules, physical/service classification, zero-cost and empty totals')
 } finally { await db.close() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
