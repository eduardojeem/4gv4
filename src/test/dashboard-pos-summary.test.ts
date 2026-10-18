// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { calculateProfit } from '@/app/dashboard/pos/dashboard/lib/pos-profit'

const migration = readFileSync('supabase/migrations/20261017213637_dashboard_pos_summary.sql', 'utf8')
const ORG = '00000000-0000-0000-0000-000000000001'
const OTHER = '00000000-0000-0000-0000-000000000002'
const BRANCH = '00000000-0000-0000-0000-000000000003'
const USER = '00000000-0000-0000-0000-000000000004'
async function database() {
 const db = new PGlite()
 await db.exec(`
 create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.has_org_permission(uuid,text) returns boolean language sql as $$select $1=nullif(current_setting('test.org',true),'')::uuid and current_setting('test.permission',true)='yes'$$;
 create table branches(id uuid,organization_id uuid,is_active boolean);
 insert into branches values('${BRANCH}','${ORG}',true),('${OTHER}','${ORG}',true);
 create function public.user_has_branch_access(uuid,uuid) returns boolean language sql as $$select nullif(current_setting('test.branch',true),'') is null or $1=nullif(current_setting('test.branch',true),'')::uuid$$;
 create table sales(id uuid primary key, organization_id uuid, branch_id uuid, created_at timestamptz, status text, code text, customer_id uuid,total_amount numeric,subtotal_amount numeric,payment_method text);
 create table products(id uuid primary key,organization_id uuid,name text,purchase_price numeric);
 create table sale_items(id uuid, sale_id uuid,product_id uuid,quantity numeric,subtotal numeric);
 create table customers(id uuid,name text);
 create table customer_credits(id uuid,organization_id uuid,branch_id uuid,created_at timestamptz,status text,origin_type text,principal numeric);
 create table credit_installments(credit_id uuid,amount numeric,amount_paid numeric);
 create table repairs(id uuid,organization_id uuid,branch_id uuid,created_at timestamptz,delivered_at timestamptz,status text,final_cost numeric,estimated_cost numeric,paid_amount numeric,parts_cost numeric,labor_cost numeric);
 create table after_sales_cases(id uuid,organization_id uuid,source_type text,status text,refund_amount numeric,resolved_at timestamptz,sale_id uuid,repair_id uuid);
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid() to authenticated;
 grant select on all tables in schema public to authenticated;
 alter table sales enable row level security;
 create policy scoped on sales to authenticated using(organization_id=nullif(current_setting('test.org',true),'')::uuid and (nullif(current_setting('test.branch',true),'') is null or branch_id=nullif(current_setting('test.branch',true),'')::uuid));
 `)
 await db.exec(migration)
 await db.exec(`select set_config('test.uid','${USER}',false),set_config('test.org','${ORG}',false),set_config('test.permission','yes',false),set_config('test.branch','',false);`)
 return db
}
async function summary(db: PGlite, org=ORG, branch: string | null=BRANCH) {
 const {rows} = await db.query<{summary: { totalSales:number; totalTransactions:number; totalCost:number; netSales:number; itemsWithoutCost:number;creditStats:{totalAmount:number;pendingAmount:number;count:number}; refunds:{salesAmount:number; repairsAmount:number}; repairStats:{netProfit:number}; dailySales:unknown[]; recentSales:unknown[] }}>('select public.dashboard_pos_summary($1,$2,$3,$4,$5) as summary',[org,branch,'2026-10-17T00:00:00Z','2026-10-17T23:59:59.999Z','UTC'])
 return rows[0].summary
}

describe('POS aggregate RPC',()=>{
 it('aggregates more than 1000 sales without returning raw details, preserving cost/tax/refund economics',async()=>{
  const db=await database()
  try {
   await db.exec(`insert into sales select md5(g::text)::uuid,'${ORG}','${BRANCH}','2026-10-17T12:00:00Z','completed','S'||g,null,110,100,'cash' from generate_series(1,1005)g;
   insert into products values(md5('product')::uuid,'${ORG}','Artículo',30),(md5('zero')::uuid,'${ORG}','Sin costo',0);
   insert into sale_items values(md5('zeroitem')::uuid,md5('1')::uuid,md5('zero')::uuid,1,0),(md5('deleteditem')::uuid,md5('1')::uuid,null,1,0);
   insert into sale_items select md5(('item'||g)::text)::uuid,md5(g::text)::uuid,md5('product')::uuid,2,110 from generate_series(1,1005)g;
   insert into after_sales_cases values(md5('completed')::uuid,'${ORG}','sale','completed',10,'2026-10-17T13:00Z',md5('1')::uuid,null),(md5('approved')::uuid,'${ORG}','sale','approved',500,'2026-10-17T13:00Z',md5('2')::uuid,null),(md5('spanish')::uuid,'${ORG}','sale','completado',5,'2026-10-17T13:00Z',md5('3')::uuid,null);
   insert into customer_credits select md5(('credit'||g)::text)::uuid,'${ORG}','${BRANCH}','2026-10-17T12:00Z','active','sale',90 from generate_series(1,1005)g;
   insert into credit_installments select md5(('credit'||g)::text)::uuid,120,20 from generate_series(1,1005)g;
   insert into repairs values(md5('paidrepair')::uuid,'${ORG}','${BRANCH}','2026-10-17T12:00Z','2026-10-17T13:00Z','entregado',100,500,100,30,10),(md5('freerepair')::uuid,'${ORG}','${BRANCH}','2026-10-17T12:00Z','2026-10-17T13:00Z','entregado',0,900,0,0,0);
   insert into after_sales_cases values(md5('repairrefund')::uuid,'${ORG}','repair','completed',20,'2026-10-17T13:00Z',null,md5('paidrepair')::uuid);
   set role authenticated;`)
   const result=await summary(db)
   expect(result.totalTransactions).toBe(1005);expect(result.totalSales).toBe(110550);expect(result.totalCost).toBe(60300);expect(result.itemsWithoutCost).toBe(2)
   expect(result.creditStats).toMatchObject({totalAmount:120600,pendingAmount:100500,count:1005})
   expect(result.repairStats.netProfit).toBe(50)
   expect(result.refunds.salesAmount).toBe(15);expect(result.recentSales).toHaveLength(10)
   expect(result).not.toHaveProperty('allSales');expect(result).not.toHaveProperty('allCredits')
   const profit=calculateProfit({totalSales:result.totalSales-result.refunds.salesAmount,netSales:result.netSales-result.refunds.salesAmount,totalCost:result.totalCost,repairDeliveredAmount:result.repairStats.netProfit})
   expect(profit.withTax.salesProfit).toBe(50235);expect(profit.withoutTax.salesProfit).toBe(40185)
  }finally{await db.close()}
 },30000)
 it('enforces membership permission, tenant predicate, branch filtering and caller RLS',async()=>{
  const db=await database()
  try{
   await db.exec(`insert into sales values(md5('one')::uuid,'${ORG}','${BRANCH}','2026-10-17T12:00Z','completed','one',null,10,10,'cash'),(md5('otherbranch')::uuid,'${ORG}','${OTHER}','2026-10-17T12:00Z','completed','two',null,20,20,'cash'),(md5('othertenant')::uuid,'${OTHER}','${BRANCH}','2026-10-17T12:00Z','completed','three',null,900,900,'cash');set role authenticated;`)
   expect((await summary(db)).totalSales).toBe(10)
   expect((await summary(db,ORG,null)).totalSales).toBe(30)
   await db.exec(`select set_config('test.branch','${BRANCH}',false)`)
   expect((await summary(db,ORG,null)).totalSales).toBe(10)
   // Production sales RLS can be organization-only: the RPC must still enforce assignments.
   await db.exec(`reset role; alter policy scoped on sales using(organization_id=nullif(current_setting('test.org',true),'')::uuid); set role authenticated;`)
   expect((await summary(db,ORG,null)).totalSales).toBe(10)
   await expect(db.query('select public.dashboard_pos_summary($1,$2,$3,$4,$5)',[ORG,BRANCH,'2026-10-17T00:00Z','2026-10-17T23:00Z','invalid/timezone'])).rejects.toThrow('Zona horaria')
   await expect(db.query('select public.dashboard_pos_summary($1,$2,$3,$4,$5)',[ORG,BRANCH,'1900-01-01T00:00Z','2026-10-17T23:00Z','UTC'])).rejects.toThrow('máximo 20 años')
   await expect(summary(db,OTHER)).rejects.toThrow()
   await expect(summary(db,ORG,'00000000-0000-0000-0000-000000000099')).rejects.toThrow('Sucursal')
   await expect(summary(db,ORG,OTHER)).rejects.toThrow('Sucursal')
   await db.exec(`select set_config('test.permission','no',false)`)
   await expect(summary(db)).rejects.toThrow()
  }finally{await db.close()}
 },30000)
})
