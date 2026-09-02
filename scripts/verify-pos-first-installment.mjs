// Run with PGLITE_MODULE pointing to @electric-sql/pglite's index.js, or install
// that package in an isolated test environment. Never connects to Supabase.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite')
const db = new PGlite()
const org = '00000000-0000-4000-8000-000000000001'
const branch = '00000000-0000-4000-8000-000000000002'
const actor = '00000000-0000-4000-8000-000000000003'
const session = '00000000-0000-4000-8000-000000000004'
await db.exec(`
create role service_role;
create table products(id uuid);
create table organization_members(organization_id uuid,user_id uuid,status text,role text);
create table cash_closures(id uuid,organization_id uuid,branch_id uuid,date date);
create table customer_credits(id uuid primary key,organization_id uuid,branch_id uuid,sale_id uuid,principal numeric,metadata jsonb,status text,start_date timestamptz default now(),updated_at timestamptz);
create table credit_installments(id uuid primary key default gen_random_uuid(),credit_id uuid,installment_number int,amount numeric,amount_paid numeric default 0,status text default 'pending',due_date timestamptz default now(),paid_at timestamptz,payment_method text,updated_at timestamptz);
create table credit_payments(id uuid primary key default gen_random_uuid(),credit_id uuid,installment_id uuid,amount numeric,payment_method text,notes text);
create table cash_movements(session_id uuid,type text,amount numeric,reason text,payment_method text,created_by uuid,created_at timestamptz,organization_id uuid,branch_id uuid);
insert into organization_members values('${org}','${actor}','active','cashier');
insert into cash_closures values('${session}','${org}','${branch}',null);
`)
const original = readFileSync('supabase/migrations/20260805090000_charge_repair_balance_due.sql','utf8')
const functionStart = original.indexOf('create or replace function public.process_pos_sale_atomic_v2(')
await db.exec(original.slice(functionStart, original.indexOf('$$;', functionStart) + 3))
await db.exec(readFileSync('supabase/migrations/20260902010235_credit_first_installment_timing.sql','utf8'))
const paymentMigration = readFileSync('supabase/migrations/20260902014150_pos_collect_first_installment.sql','utf8')
await db.exec(paymentMigration)
await db.exec(paymentMigration)
const triggerSource = readFileSync('supabase/migrations/20260308010000_harden_credits_rls_and_payments.sql','utf8')
const triggerStart = triggerSource.indexOf('CREATE OR REPLACE FUNCTION public.apply_installment_payment()')
await db.exec(triggerSource.slice(triggerStart, triggerSource.indexOf('$$;',triggerStart)+3))
await db.exec('create trigger apply_payment after insert or update or delete on credit_payments for each row execute function apply_installment_payment();')
async function seed(id, count = 3) {
  await db.query("insert into customer_credits(id,organization_id,branch_id,sale_id,principal,metadata,status) values($1,$2,$3,$1,$4,'{\"first_installment_timing\":\"at_start\",\"frequency\":\"monthly\"}','active')",[id,org,branch,count*100])
  await db.query('insert into credit_installments(credit_id,installment_number,amount) select $1,n,100 from generate_series(1,$2::int) n',[id,count])
}
async function collect(id, payment, organization = org) {
  return db.query('select collect_pos_first_installment($1,$2,$3,$4,$5,$6::jsonb)',[organization,branch,actor,session,id,JSON.stringify(payment)])
}
const cashCredit = '00000000-0000-4000-8000-000000000011'
await seed(cashCredit)
await collect(cashCredit,{method:'cash',cashReceived:150,amount:1})
await collect(cashCredit,{method:'cash',cashReceived:150})
assert.equal((await db.query('select count(*)::int n from credit_payments')).rows[0].n,1)
assert.deepEqual((await db.query('select amount,session_id from cash_movements')).rows,[{amount:'100',session_id:session}])
assert.deepEqual((await db.query('select status from credit_installments where credit_id=$1 order by installment_number',[cashCredit])).rows.map(i=>i.status),['paid','pending','pending'])
const summary = (await db.query('select pos_credit_checkout_summary($1,$2) summary',[org,cashCredit])).rows[0].summary
assert.equal(summary.firstPayment.amount,100)
assert.equal(summary.firstPayment.change,50)
assert.equal(summary.remainingBalance,200)
const transferCredit = '00000000-0000-4000-8000-000000000012'
await seed(transferCredit,1)
await assert.rejects(collect(transferCredit,{method:'transfer',bank:'Banco'}),/FIRST_INSTALLMENT_TRANSFER_REQUIRED/)
await collect(transferCredit,{method:'transfer',bank:'Banco',reference:'REF123'})
assert.equal((await db.query('select status from customer_credits where id=$1',[transferCredit])).rows[0].status,'completed')
assert.equal((await db.query('select count(*)::int n from cash_movements')).rows[0].n,1)
await assert.rejects(collect(transferCredit,{method:'cash',cashReceived:100},branch),/POS_PERMISSION_DENIED/)
// Force an accounting failure after the payment insert: every write rolls back.
await db.exec("create function fail_cash() returns trigger language plpgsql as $$ begin raise exception 'TEST_CASH_FAILURE'; end $$; create trigger fail_cash before insert on cash_movements for each row execute function fail_cash();")
const failedCredit = '00000000-0000-4000-8000-000000000013'
await db.exec('begin')
await seed(failedCredit)
await assert.rejects(collect(failedCredit,{method:'cash',cashReceived:100}),/TEST_CASH_FAILURE/)
await db.exec('rollback')
assert.equal((await db.query('select count(*)::int n from customer_credits where id=$1',[failedCredit])).rows[0].n,0)
assert.equal((await db.query('select count(*)::int n from credit_payments')).rows[0].n,2)
console.log('PASS: migration compiles/reruns; cash, transfer, change, paid status, single-installment completion, tenant rejection, idempotent collection and rollback verified.')
await db.close()
