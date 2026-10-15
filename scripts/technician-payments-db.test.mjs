import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const db = new PGlite()
const org = '11111111-1111-4111-8111-111111111111'
const actor = '22222222-2222-4222-8222-222222222222'
const tech = '33333333-3333-4333-8333-333333333333'
const branch = '44444444-4444-4444-8444-444444444444'
const session = '55555555-5555-4555-8555-555555555555'
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.organizations(id uuid primary key);
    create table public.branches(id uuid primary key, organization_id uuid, is_active boolean default true);
    create table public.organization_members(organization_id uuid,user_id uuid,status text,role text);
    create table public.payroll_runs(id uuid primary key,organization_id uuid,period_from date,period_to date,status text);
    create table public.payroll_entries(id uuid primary key default gen_random_uuid(),organization_id uuid,payroll_run_id uuid,employee_id uuid,legacy_source_id uuid);
    create table public.payroll_payments(id uuid primary key default gen_random_uuid(),organization_id uuid,payroll_entry_id uuid,legacy_source_id uuid,direction text default 'payment');
    create table public.cash_registers(id uuid primary key,organization_id uuid,branch_id uuid,is_active boolean);
    create table public.cash_closures(id uuid primary key,organization_id uuid,branch_id uuid,date date,register_id text,created_at timestamptz default now(),last_activity_at timestamptz,updated_at timestamptz);
    create table public.cash_movements(id uuid primary key default gen_random_uuid(), organization_id uuid,branch_id uuid,session_id uuid,type text,amount numeric,reason text,payment_method text,created_by uuid,created_at timestamptz default now());
    create function public.has_org_permission(uuid,text) returns boolean language sql as $$ select current_setting('test.allowed',true)='true' $$;
    create function public.user_has_branch_access(uuid,uuid) returns boolean language sql as $$ select $1='${branch}'::uuid $$;
    create function public.assert_service_cash_actor(uuid) returns void language plpgsql as $$ begin if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if; perform set_config('request.jwt.claim.sub',$1::text,true); end $$;
    insert into auth.users values ('${actor}'),('${tech}'); insert into organizations values ('${org}');
    insert into branches values ('${branch}','${org}',true);
    insert into organization_members values ('${org}','${actor}','active','owner'),('${org}','${tech}','active','technician');
    insert into cash_registers values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${org}','${branch}',true);
    insert into cash_closures(id,organization_id,branch_id,register_id) values ('${session}','${org}','${branch}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    select set_config('request.jwt.claim.role','service_role',false),set_config('test.allowed','true',false);`)
  const baseline = await readFile(new URL('../supabase/migrations/20260927000000_baseline_schema.sql', import.meta.url),'utf8')
  const definition = baseline.match(/CREATE TABLE IF NOT EXISTS "public"\."technician_payments" \([\s\S]*?\n\);/)[0]
  await db.exec(definition + '; alter table technician_payments add primary key(id);')
  await db.exec(baseline.match(/CREATE OR REPLACE FUNCTION "public"\."record_cash_movement_atomic"\([\s\S]*?\n\$\$;/)[0])
  const cashWrappers=await readFile(new URL('../supabase/migrations/20260927120251_server_only_cash_rpcs.sql',import.meta.url),'utf8')
  await db.exec(cashWrappers.match(/create or replace function public\.server_record_cash_movement_atomic\([\s\S]*?\n\$\$;/)[0])
  const files = await readdir(new URL('../supabase/migrations/',import.meta.url))
  await db.exec(await readFile(new URL('../supabase/migrations/' + files.find(f=>f.endsWith('_technician_payments_atomic.sql')),import.meta.url),'utf8'))
})
after(()=>db.close())
const input = { period_from:'2026-10-01',period_to:'2026-10-31',amount:100,method:'efectivo',status:'pagado' }
const create = (key,body=input,b=branch,a=actor) => db.query('select public.server_create_technician_payment($1,$2,$3,$4,$5,$6) as result',[org,b,a,tech,key,body]).then(r=>r.rows[0].result)
const transition = (id,key,action,t=tech,a=actor) => db.query('select public.server_transition_technician_payment($1,$2,$3,$4,$5,$6,$7) as result',[org,branch,a,t,id,key,action]).then(r=>r.rows[0].result)
test('payout retry returns the same payment and one cash movement',async()=>{
  const first=await create('retry-payment'); const second=await create('retry-payment');
  assert.equal(first.id,second.id)
  assert.equal((await db.query('select count(*)::int n from cash_movements')).rows[0].n,1)
  await assert.rejects(create('retry-payment',{...input,amount:200}),/IDEMPOTENCY_CONFLICT/)
})
test('closed or unauthorized cash branch persists no payment',async()=>{
  await assert.rejects(create('wrong-branch',input,'66666666-6666-4666-8666-666666666666'),/FORBIDDEN/)
  await db.exec(`update cash_closures set date=current_date where id='${session}'`)
  await assert.rejects(create('closed-cash'),/CASH_CLOSED/)
  assert.equal((await db.query('select count(*)::int n from technician_payments')).rows[0].n,1)
  await db.exec('update cash_closures set date=null')
})
test('confirmation disburses pending cash and cancellation reverses only once',async()=>{
  const p=await create('pending-payment',{...input,status:'pendiente'})
  await transition(p.id,'confirm-payment','confirmar')
  const reversed=await transition(p.id,'cancel-payment','anular')
  assert.equal(reversed.status,'anulado')
  await transition(p.id,'cancel-payment','anular')
  await assert.rejects(transition(p.id,'second-cancel','anular'),/INVALID_TRANSITION/)
  assert.equal((await db.query("select count(*)::int n from cash_movements where type='cash_in'")).rows[0].n,1)
})
test('wrong technician, unauthorized actor and receipt on pending are rejected',async()=>{
  const p=await create('receipt-pending',{...input,status:'pendiente'})
  await assert.rejects(transition(p.id,'wrong-technician','confirmar',actor),/PAYMENT_NOT_FOUND/)
  await assert.rejects(create('tech-self-payment',input,branch,tech),/FORBIDDEN/)
  await assert.rejects(transition(p.id,'receipt-pending-key','confirmar_recibo',tech,tech),/INVALID_TRANSITION/)
})
test('a payment mapped to payroll cannot be mutated through the old circuit',async()=>{
  const p=await create('mapped-payment',{...input,method:'transferencia'})
  await db.query('insert into payroll_entries(organization_id,employee_id,legacy_source_id) values($1,$2,$3)',[org,tech,p.id])
  await assert.rejects(transition(p.id,'mapped-cancel','anular'),/USE_PAYROLL/)
})
test('an unverified historical movement cannot create a cash refund',async()=>{
  const p=await create('unverified-movement',{...input,method:'transferencia'})
  await db.query("update technician_payments set method='efectivo',cash_movement_id='66666666-6666-4666-8666-666666666666' where id=$1",[p.id])
  await assert.rejects(transition(p.id,'unverified-reversal','anular'),/LEGACY_CASH_REQUIRED/)
})
test('new payroll cannot silently regenerate an already paid basic period',async()=>{
  const run='77777777-7777-4777-8777-777777777777'
  await db.query("insert into payroll_runs values($1,$2,'2026-10-01','2026-10-31','approved')",[run,org])
  await assert.rejects(db.query('insert into payroll_entries(organization_id,payroll_run_id,employee_id) values($1,$2,$3)',[org,run,tech]),/RECONCILIATION_REQUIRED/)
})
test('existing payroll cannot disburse over an unreconciled historical payment',async()=>{
  const run='88888888-8888-4888-8888-888888888888'
  await db.query("insert into payroll_runs values($1,$2,'2026-11-01','2026-11-30','approved')",[run,org])
  const entry=(await db.query('insert into payroll_entries(organization_id,payroll_run_id,employee_id) values($1,$2,$3) returning id',[org,run,tech])).rows[0].id
  await db.query("insert into technician_payments(organization_id,technician_id,branch_id,period_from,period_to,amount,method,status) values($1,$2,$3,'2026-11-01','2026-11-30',100,'transferencia','pagado')",[org,tech,branch])
  await assert.rejects(db.query('insert into payroll_payments(organization_id,payroll_entry_id) values($1,$2)',[org,entry]),/RECONCILIATION_REQUIRED/)
})
test('real cash RPC rejects inactive registers and rolls back the payment',async()=>{
  const before=(await db.query('select count(*)::int n from technician_payments')).rows[0].n
  await db.exec('update cash_registers set is_active=false')
  await assert.rejects(create('inactive-register',{...input,period_from:'2026-12-01',period_to:'2026-12-31'}),/OPEN_CASH_SESSION_NOT_FOUND/)
  assert.equal((await db.query('select count(*)::int n from technician_payments')).rows[0].n,before)
  await db.exec('update cash_registers set is_active=true')
})
test('transactional RPCs are inaccessible to public clients',async()=>{
  const result=(await db.query("select has_function_privilege('anon','public.server_create_technician_payment(uuid,uuid,uuid,uuid,text,jsonb)','execute') anon,has_function_privilege('authenticated','public.server_create_technician_payment(uuid,uuid,uuid,uuid,text,jsonb)','execute') authenticated,has_function_privilege('service_role','public.server_create_technician_payment(uuid,uuid,uuid,uuid,text,jsonb)','execute') service")).rows[0]
  assert.deepEqual(result,{anon:false,authenticated:false,service:true})
})
