import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
const db=new PGlite()
const org='11111111-1111-4111-8111-111111111111', tech='33333333-3333-4333-8333-333333333333', branch='44444444-4444-4444-8444-444444444444', repair='66666666-6666-4666-8666-666666666666'
const oldVersion='77777777-7777-4777-8777-777777777777',newVersion='88888888-8888-4888-8888-888888888888'
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select '${tech}'::uuid $$;
    create type organization_role as enum ('owner','admin','manager','seller','cashier','technician','customer','delivery','inventory','accountant');
    create table organization_settings(organization_id uuid,timezone text);
    create table branches(id uuid,organization_id uuid,is_active boolean);
    create table technician_compensation(id uuid,organization_id uuid,technician_id uuid);
    create table technician_compensation_versions(id uuid,organization_id uuid,technician_id uuid);
    create function public.has_org_permission(uuid,text) returns boolean language sql as $$ select true $$;
    create function public.get_user_role(uuid) returns text language sql as $$ select 'technician'::text $$;
    create function public.user_has_branch_access(uuid,uuid) returns boolean language sql as $$ select true $$;
    insert into organization_settings values('${org}','UTC'); insert into branches values('${branch}','${org}',true);
    insert into technician_compensation_versions values('${oldVersion}','${org}','${tech}'),('${newVersion}','${org}','${tech}');`)
  const baseline=await readFile(new URL('../supabase/migrations/20260927000000_baseline_schema.sql',import.meta.url),'utf8')
  for(const table of ['commission_rules','earned_commissions','commission_operation_attributions','commission_sale_item_attributions','commission_terminal_events','commission_refund_events']){
    const definition=baseline.match(new RegExp('CREATE TABLE IF NOT EXISTS "public"\\."'+table+'" \\([\\s\\S]*?\\n\\);'))[0]
    await db.exec(definition+`;alter table ${table} add primary key(id);`)
  }
  await db.exec('create unique index commission_origin on earned_commissions(organization_id,origin_key)')
  const fixes=await readFile(new URL('../supabase/migrations/20260927024526_fix_function_lint_errors.sql',import.meta.url),'utf8')
  await db.exec(fixes.match(/CREATE OR REPLACE FUNCTION public\.calculate_earned_commissions[\s\S]*?\n\$function\$\s*;/)[0])
  const filename=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(f=>f.endsWith('_technician_canonical_commissions.sql'))
  await db.exec(await readFile(new URL('../supabase/migrations/'+filename,import.meta.url),'utf8'))
  await db.query(`insert into commission_rules(organization_id,scope_type,employee_id,source_type,accrual_status,calculation_type,value,status,effective_from,effective_to,legacy_source_id,legacy_component,legacy_cutover_on,approved_at)
    values($1,'employee',$2,'repair_labor','listo','percentage',10,'approved','2026-09-01','2026-09-30',$3,'percentage','2026-09-01',now()),
    ($1,'employee',$2,'repair','entregado','percentage',20,'approved','2026-10-01',null,$4,'percentage','2026-10-01',now())`,[org,tech,oldVersion,newVersion])
  await db.query(`insert into commission_operation_attributions(organization_id,branch_id,source_type,source_id,employee_id,employee_role,accrual_status,occurred_at,basis_amount,labor_basis_amount)
    values($1,$2,'repair',$3,$4,'technician','listo','2026-09-29T12:00:00Z',200,100),
    ($1,$2,'repair',$3,$4,'technician','entregado','2026-10-05T12:00:00Z',200,100)`,[org,branch,repair,tech])
})
after(()=>db.close())
beforeEach(()=>db.exec('delete from earned_commissions'))
const calculate=(month)=>db.query('select public.calculate_earned_commissions($1,$2,$3,null) n',[org,`2026-${month}-01`,`2026-${month}-${month==='09'?'30':'31'}`])
test('October calculated before September cannot select a later accrual',async()=>{
  await calculate('10')
  assert.equal((await db.query('select count(*)::int n from earned_commissions')).rows[0].n,0)
  await calculate('09')
  assert.equal((await db.query('select amount::int from earned_commissions')).rows[0].amount,10)
})
test('changing labor basis to total cannot accrue an already materialized repair twice',async()=>{
  await calculate('09'); await calculate('10')
  const result=(await db.query('select count(*)::int n,sum(amount)::int total from earned_commissions')).rows[0]
  assert.deepEqual(result,{n:1,total:10})
})
test('fixed compensation also applies to zero-cost repair events',async()=>{
  await db.exec('update commission_operation_attributions set basis_amount=0,labor_basis_amount=0')
  await db.query("insert into commission_rules(organization_id,scope_type,employee_id,source_type,accrual_status,calculation_type,value,status,effective_from,effective_to,legacy_source_id,legacy_component,legacy_cutover_on,approved_at) values($1,'employee',$2,'repair_labor','listo','fixed',5,'approved','2026-09-01','2026-09-30',$3,'fixed','2026-09-01',now())",[org,tech,oldVersion])
  await calculate('09')
  assert.equal((await db.query('select coalesce(sum(amount),0)::int amount from earned_commissions')).rows[0].amount,5)
})
test('filtering another branch cannot choose a later repair event',async()=>{
  const otherBranch='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await db.query('insert into branches values($1,$2,true)',[otherBranch,org])
  await db.exec('update commission_operation_attributions set basis_amount=200,labor_basis_amount=100')
  await db.query("update commission_operation_attributions set branch_id=$1 where accrual_status='entregado'",[otherBranch])
  await db.query("select public.calculate_earned_commissions($1,'2026-10-01','2026-10-31',$2)",[org,otherBranch])
  assert.equal((await db.query('select count(*)::int n from earned_commissions')).rows[0].n,0)
})
