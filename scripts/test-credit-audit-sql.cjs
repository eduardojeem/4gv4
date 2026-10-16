// Runs only in an isolated, in-memory PostgreSQL instance. No Supabase connection.
// Install @electric-sql/pglite in a temporary directory, then pass its package.json.
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { createRequire } = require('node:module')
const { strict: assert } = require('node:assert')
const { PGlite } = createRequire(resolve(process.argv[2] || 'package.json'))('@electric-sql/pglite')

async function main() {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create function public.has_org_permission(uuid,text) returns boolean language sql as $$select true$$;
      create function public.user_has_branch_access(uuid,uuid) returns boolean language sql as $$select true$$;
      create table organizations(id uuid primary key,name text);
      create table organization_members(organization_id uuid,user_id uuid,status text,role text);
      create table organization_settings(organization_id uuid,display_name text,currency text,timezone text,modules jsonb);
      create table system_settings(id text primary key,company_name text,company_phone text,company_ruc text,company_address text);
      create table customers(id uuid primary key,organization_id uuid,name text,customer_code text,ruc text);
      create table branches(id uuid primary key,organization_id uuid,is_active boolean,is_default boolean,phone text,address text);
      create table customer_credits(id uuid primary key,organization_id uuid,customer_id uuid,sale_id uuid,principal numeric,
        status text,credit_code text,label text,updated_at timestamptz);
      create table credit_installments(id uuid primary key,credit_id uuid,installment_number integer,due_date timestamptz,
        amount numeric,amount_paid numeric default 0,principal_component numeric,interest_component numeric,status text,paid_at timestamptz,payment_method text,updated_at timestamptz);
      create table credit_payments(id uuid primary key default gen_random_uuid(),credit_id uuid,installment_id uuid,amount numeric,payment_method text,notes text,created_at timestamptz default now());
      create table cash_closures(id uuid primary key,organization_id uuid,branch_id uuid,date timestamptz,register_id text,created_at timestamptz default now());
      create table cash_movements(id uuid primary key default gen_random_uuid(),session_id uuid,type text,amount numeric,reason text,payment_method text,created_by uuid,organization_id uuid,branch_id uuid);
      create table repairs(id uuid primary key,organization_id uuid,customer_id uuid,branch_id uuid,deleted_at timestamptz,status text,delivered_at timestamptz,created_at timestamptz,pricing_mode text,labor_cost numeric,discount_amount numeric,paid_amount numeric,final_cost numeric,estimated_cost numeric);
      create table repair_parts(repair_id uuid,unit_price numeric,unit_cost numeric,quantity numeric);
      create table customer_store_credits(organization_id uuid,customer_id uuid,amount numeric,reason text,source_type text,source_id uuid,created_by uuid);
      create table sales(id uuid primary key,organization_id uuid,code text);
      create table products(id uuid primary key,name text);
      create table sale_items(id uuid primary key,sale_id uuid,product_id uuid,quantity numeric);
      create function public.register_credit_payment_atomic(uuid,uuid,uuid,numeric,text,text) returns jsonb language sql as $$select '{}'::jsonb$$;
      grant execute on function public.register_credit_payment_atomic(uuid,uuid,uuid,numeric,text,text) to authenticated;
    `)
    const baseline = readFileSync('supabase/migrations/20260927000000_baseline_schema.sql', 'utf8')
    const trigger = baseline.match(/CREATE OR REPLACE FUNCTION "public"\."apply_installment_payment"\(\)[\s\S]*?\$\$;/)?.[0]
    assert(trigger, 'Missing real payment trigger definition')
    await db.exec(trigger)
    await db.exec('create trigger apply_payment after insert on credit_payments for each row execute function public.apply_installment_payment();')
    await db.exec(readFileSync('supabase/migrations/20261012010454_customer_collection_atomic.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/20261015215221_credit_audit_hardening.sql', 'utf8'))
    const ids = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
    const [org, customer, actor, branch, credit, installment, installment2, cash] = ids
    await db.exec(`
      insert into organizations values('${org}','Tienda prueba');
      insert into auth.users values('${actor}');
      insert into organization_members values('${org}','${actor}','active','admin');
      insert into customers values('${customer}','${org}','Cliente prueba','CLI-1','1234567');
      insert into branches values('${branch}','${org}',true,true,'0981000000','Calle prueba');
      insert into organization_settings values('${org}','Tienda original','USD','America/Asuncion','{"admin_settings":{"companyRuc":"123-4"}}');
      insert into customer_credits values('${credit}','${org}','${customer}',null,200,'active','CRE-ORIGINAL','Plan prueba',now());
      insert into credit_installments values('${installment}','${credit}',1,now()+interval '1 day',100,0,90,10,'pending',null,null,now()),
        ('${installment2}','${credit}',2,now()+interval '8 days',100,0,90,10,'pending',null,null,now());
      insert into cash_closures(id,organization_id,branch_id,register_id) values('${cash}','${org}','${branch}','principal');
    `)
    const collect = async request => (await db.query('select public.collect_customer_payment_atomic($1,$2,$3,$4,$5) result', [org, customer, actor, branch, request])).rows[0].result
    const request = { amount: 120, paymentMethod: 'cash', mode: 'auto', scope: { creditId: credit }, idempotencyKey: 'audit-request-001' }
    const first = await collect(request)
    assert.equal(first.allocations.length, 2)
    assert.equal(first.receipt.kind, 'credit')
    assert.equal(first.receipt.input.totalPaidAmount, 120)
    assert.equal(first.receipt.input.currentCreditBalance, 80)
    assert.equal(first.receipt.input.totalCreditAmount, 200)
    assert.equal(first.receipt.input.currency, 'USD')
    assert.equal(first.receipt.input.businessName, 'Tienda original')
    await db.exec(`update organization_settings set display_name='Nombre nuevo'; update credit_installments set due_date=now()+interval '2 months';`)
    const again = await collect(request)
    assert.deepEqual(again, first, 'Retry must return the original receipt after account/settings changes')
    const count = (await db.query('select count(*)::int n from credit_payments')).rows[0].n
    assert.equal(count, 2, 'Retry duplicated payments')
    const global = await collect({ amount: 30, paymentMethod: 'transfer', referenceNumber: 'REF-1', mode: 'auto', idempotencyKey: 'audit-request-002' })
    assert.equal(global.receipt.kind, 'global')
    assert.equal(global.receipt.input.referenceNumber, 'REF-1')
    assert.equal(global.receipt.input.allocations[0].allocatedAmount, 30)
    assert.equal(global.receipt.input.allocations[0].newPending, 50)
    const privileges = (await db.query("select has_function_privilege('authenticated','public.register_credit_payment_atomic(uuid,uuid,uuid,numeric,text,text)','execute') allowed")).rows[0]
    assert.equal(privileges.allowed, false)
    if (process.env.CREDIT_AUDIT_OUTPUT) writeFileSync(process.env.CREDIT_AUDIT_OUTPUT, JSON.stringify([first.receipt, global.receipt]))
    await db.query("update customer_collection_requests set result=result-'receipt' where id=$1", [first.receiptId])
    const historical = await collect(request)
    assert.equal(historical.receipt, undefined, 'An old receipt must never be backfilled from current account data')
    assert.equal(historical.receiptNumber, first.receiptNumber)
    console.log('PASS: SQL migration, scoped/multiple allocations, explicit totals, frozen identity/currency/date, idempotent retry, general receipt, legacy RPC restriction')
  } finally { await db.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
