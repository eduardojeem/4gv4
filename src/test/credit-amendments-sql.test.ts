// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const org=id(1), actor=id(2), customer=id(3), credit=id(4), inst=id(5), payment=id(6), branch=id(7), session=id(8), movement=id(9), receipt=id(10)
const base = readFileSync('supabase/migrations/20260927000000_baseline_schema.sql','utf8')
const block = (start: string, end: string, source=base) => {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(start)
  return source.slice(from,source.indexOf(end,from)+end.length)
}
let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create schema extensions; create function extensions.uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
    create table public.organizations(id uuid primary key);
    create table public.customers(id uuid primary key, organization_id uuid, credit_limit numeric default 1000000);
    create table public.organization_members(organization_id uuid,user_id uuid,role text,status text);
    create table public.organization_settings(organization_id uuid,timezone text,currency text default 'PYG');
    create table public.repairs(organization_id uuid,customer_id uuid,final_cost numeric,estimated_cost numeric,paid_amount numeric,payment_status text);
    create table public.organization_credit_file_policies(organization_id uuid,mode text);
    create function public.customer_credit_file_missing(uuid,uuid) returns text[] language sql as $$select array['approval']::text[]$$;
    create function public.get_default_branch_id() returns uuid language sql as 'select null::uuid';
    create type public.cash_movement_type as enum ('cash_in','cash_out');
  `)
  for (const name of ['customer_credits','credit_installments','credit_payments','cash_closures','cash_movements']) {
    await db.exec(block(`CREATE TABLE IF NOT EXISTS "public"."${name}"`,');'))
    await db.exec(`alter table public.${name} add primary key(id)`)
  }
  await db.exec(`alter table public.credit_installments add foreign key(credit_id) references public.customer_credits(id);
    alter table public.credit_payments add foreign key(installment_id) references public.credit_installments(id);
    create table public.customer_collection_requests(id uuid primary key, organization_id uuid,customer_id uuid,branch_id uuid,result jsonb);
  `)
  await db.exec(block('CREATE OR REPLACE FUNCTION "public"."apply_installment_payment"()', '$$;'))
  await db.exec(block('CREATE OR REPLACE TRIGGER "tr_credit_payments_insert"',';'))
  await db.exec(block('CREATE OR REPLACE TRIGGER "tr_credit_payments_update"',';'))
  await db.exec('grant insert,update,delete on public.customer_credits,public.credit_installments,public.credit_payments to anon,authenticated')
  await db.exec('alter default privileges in schema public grant all on tables to service_role')
  const concession=readFileSync('supabase/migrations/20261011161852_customer_credit_file_enforcement.sql','utf8')
  await db.exec(block('create or replace function public.lock_customer_credit_concession()', '$$;',concession))
  await db.exec(block('create trigger customer_credit_concession_lock',';',concession))
  await db.exec(block('create function public.customer_credit_outstanding(', '$$;',concession))
  await db.exec(block('create function public.check_customer_credit_concession_limit()', '$$;',concession))
  await db.exec(block('create constraint trigger customer_credit_concession_limit',';',concession))
  await db.exec(readFileSync('supabase/migrations/20261017100000_credit_amendments.sql','utf8'))
},30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`truncate public.credit_amendments,public.credit_payments,public.credit_installments,public.customer_credits,
    public.customer_collection_requests,public.cash_movements,public.cash_closures,public.organization_members,
    public.organization_settings,public.organization_credit_file_policies,public.customers,public.organizations,auth.users cascade;
    insert into public.organizations values('${org}'); insert into auth.users values('${actor}');
    insert into public.customers(id,organization_id) values('${customer}','${org}');
    insert into public.organization_members values('${org}','${actor}','admin','active');
    insert into public.organization_settings(organization_id,timezone) values('${org}','America/Asuncion');
    insert into public.customer_credits(id,customer_id,organization_id,principal,interest_rate,term_months,start_date,status)
      values('${credit}','${customer}','${org}',1000,0,1,now()-interval '3 days','active');
    insert into public.credit_installments(id,credit_id,installment_number,due_date,amount,principal_component,status)
      values('${inst}','${credit}',1,now()+interval '1 month',1000,1000,'pending');`)
})
const snapshot = async (organizationId=org, actorId=actor) => (await db.query<{result: {version:string; credit: {principal:number}; history:unknown[]}}>(
  'select public.get_credit_amendment_state($1,$2,$3) as result',[organizationId,credit,actorId])).rows[0].result
async function amend(payload: Record<string, unknown>, version?: string) {
  return (await db.query<{result: {version:string}}>('select public.amend_customer_credit_atomic($1,$2,$3,$4) as result',[
    org,credit,actor,{expectedVersion: version ?? (await snapshot()).version,reason:'Corrección autorizada por cliente',...payload},
  ])).rows[0].result
}
async function pay(amount=200) {
  await db.exec(`insert into public.credit_payments(id,credit_id,installment_id,amount,payment_method,created_at)
    values('${payment}','${credit}','${inst}',${amount},'cash',now()-interval '1 hour');`)
}
describe('atomic audited credit amendments', () => {
  it('enforces tenant and admin membership in the database', async () => {
    await expect(snapshot(id(99))).rejects.toThrow('AMEND_FORBIDDEN')
    await db.exec("update public.organization_members set role='seller'")
    await expect(snapshot()).rejects.toThrow('AMEND_FORBIDDEN')
    await expect(amend({action:'reschedule',installments:[]} ,'x')).rejects.toThrow('AMEND_FORBIDDEN')
  })
  it('replaces an unpaid plan and records before/after, actor and reason', async () => {
    const result=await amend({action:'edit_terms',interestRate:10,frequency:'monthly',plan:[
      {dueDate:'2026-11-10',amount:550,principalComponent:500,interestComponent:50},
      {dueDate:'2026-12-10',amount:550,principalComponent:500,interestComponent:50},
    ]})
    expect(result.version).not.toBe('')
    const rows=(await db.query<{principal:string;term_months:number}>('select principal,term_months from public.customer_credits')).rows
    expect(rows[0]).toEqual({principal:'1100',term_months:2})
    const audit=(await db.query<{actor_id:string;before_state:{installments:unknown[]};after_state:{installments:unknown[]}}>('select * from public.credit_amendments')).rows[0]
    expect(audit.actor_id).toBe(actor)
    expect(audit.before_state.installments).toHaveLength(1)
    expect(audit.after_state.installments).toHaveLength(2)
  })
  it('rejects stale forms and missing reasons without modifying the debt', async () => {
    const old=(await snapshot()).version
    await amend({action:'adjust_balance',installmentId:inst,amount:900})
    await expect(amend({action:'adjust_balance',installmentId:inst,amount:800},old)).rejects.toThrow('AMEND_CONFLICT')
    await expect(amend({action:'adjust_balance',installmentId:inst,amount:800,reason:''})).rejects.toThrow('AMEND_INVALID')
    expect(Number((await db.query<{amount:string}>('select amount from public.credit_installments')).rows[0].amount)).toBe(900)
  })
  it('preserves payments and blocks complete term replacement after any payment', async () => {
    await pay()
    await expect(amend({action:'edit_terms',plan:[]})).rejects.toThrow('AMEND_HAS_PAYMENTS')
    await amend({action:'reschedule',installments:[{id:inst,dueDate:'2026-12-15'}]})
    const row=(await db.query<{day:string;amount_paid:string}>("select to_char(due_date at time zone 'America/Asuncion','YYYY-MM-DD') as day,amount_paid from public.credit_installments")).rows[0]
    expect(row).toEqual({day:'2026-12-15',amount_paid:'200'})
    expect(Number((await db.query<{amount:string}>('select amount from public.credit_payments')).rows[0].amount)).toBe(200)
  })
  it('requires adjustments to cover existing payments and records an explicit delta', async () => {
    await pay()
    await expect(amend({action:'adjust_balance',installmentId:inst,amount:100})).rejects.toThrow('AMEND_BELOW_PAID')
    await amend({action:'adjust_balance',installmentId:inst,amount:800})
    expect(Number((await db.query<{principal:string}>('select principal from public.customer_credits')).rows[0].principal)).toBe(800)
    expect(Number((await db.query<{debt_delta:string}>('select debt_delta from public.credit_amendments')).rows[0].debt_delta)).toBe(-200)
  })
  it('cannot alter a paid installment or a foreign installment', async () => {
    await pay(1000)
    await expect(amend({action:'reschedule',installments:[{id:inst,dueDate:'2026-12-15'}]})).rejects.toThrow('AMEND_CLOSED_CREDIT')
    await db.exec("update public.customer_credits set status='active'")
    await expect(amend({action:'reschedule',installments:[{id:inst,dueDate:'2026-12-15'}]})).rejects.toThrow('AMEND_INSTALLMENT')
    await expect(amend({action:'adjust_balance',installmentId:id(99),amount:800})).rejects.toThrow('AMEND_INSTALLMENT')
  })
  async function linkCash(closed=false) {
    await db.exec(`insert into public.cash_closures(id,type,register_id,date,created_at,status,branch_id,organization_id)
      values('${session}','apertura','principal',${closed?'now()':'null'},now()-interval '2 days','${closed?'cerrada':'abierta'}','${branch}','${org}');
      insert into public.cash_movements(id,type,amount,payment_method,reason,session_id,branch_id,organization_id)
      values('${movement}','cash_in',200,'efectivo','Cobro crédito · ${receipt}','${session}','${branch}','${org}');
      insert into public.customer_collection_requests values('${receipt}','${org}','${customer}','${branch}',
      '{"allocations":[{"type":"installment","paymentId":"${payment}"}],"excessToStoreCredit":0}');`)
  }
  const paidAt=()=>new Date(Date.now()-30*60000).toISOString()
  it('corrects the payment and its cash movement atomically, keeping the original in history',async () => {
    await pay(); await linkCash()
    const date=paidAt()
    await amend({action:'correct_payment_date',paymentId:payment,paidAt:date})
    const row=(await db.query<{same:boolean}>(`select p.created_at=m.created_at and m.timestamp=p.created_at as same from public.credit_payments p cross join public.cash_movements m`)).rows[0]
    expect(row.same).toBe(true)
    expect((await snapshot()).history).toHaveLength(1)
    expect(Number((await db.query<{amount_paid:string}>('select amount_paid from public.credit_installments')).rows[0].amount_paid)).toBe(200)
  })
  it('blocks closed cash sessions and untraceable historical cash payments',async () => {
    await pay()
    await expect(amend({action:'correct_payment_date',paymentId:payment,paidAt:paidAt()})).rejects.toThrow('AMEND_PAYMENT_UNLINKED')
    await linkCash(true)
    await expect(amend({action:'correct_payment_date',paymentId:payment,paidAt:paidAt()})).rejects.toThrow('AMEND_CASH_CLOSED')
    expect((await snapshot()).history).toHaveLength(0)
  })
  it('blocks ambiguous consolidated receipts instead of changing only one side',async () => {
    await pay(); await linkCash()
    await db.exec(`update public.customer_collection_requests set result=jsonb_set(result,'{excessToStoreCredit}','100')`)
    await expect(amend({action:'correct_payment_date',paymentId:payment,paidAt:paidAt()})).rejects.toThrow('AMEND_CONSOLIDATED_PAYMENT')
  })
  it('does not grant the browser a direct amendment or audit write path',async () => {
    const row=(await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.amend_customer_credit_atomic(uuid,uuid,uuid,jsonb)','execute') as allowed")).rows[0]
    expect(row.allowed).toBe(false)
    expect((await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','public.credit_amendments','insert') as allowed")).rows[0].allowed).toBe(false)
    expect((await db.query<{allowed:boolean}>("select has_table_privilege('service_role','public.credit_amendments','update,delete,truncate') as allowed")).rows[0].allowed).toBe(false)
    for(const table of ['customer_credits','credit_installments','credit_payments']) {
      for(const role of ['anon','authenticated']) {
        expect((await db.query<{allowed:boolean}>(`select has_table_privilege('${role}','public.${table}','insert,update,delete') as allowed`)).rows[0].allowed).toBe(false)
      }
    }
  })
  it('rolls back amounts AND audit when the real deferred cupo check fails',async()=>{
    await db.exec(`update public.customers set credit_limit=1100`)
    await expect(amend({action:'adjust_balance',installmentId:inst,amount:1200})).rejects.toThrow('CREDIT_LIMIT_EXCEEDED')
    expect(Number((await db.query<{amount:string}>('select amount from public.credit_installments')).rows[0].amount)).toBe(1000)
    expect((await snapshot()).history).toHaveLength(0)
  })
  it('respects whole guaranies while supporting fractional currency amounts',async()=>{
    await expect(amend({action:'adjust_balance',installmentId:inst,amount:900.25})).rejects.toThrow('AMEND_INVALID')
    await db.exec("update public.organization_settings set currency='USD'")
    await amend({action:'adjust_balance',installmentId:inst,amount:900.25})
    expect(Number((await db.query<{amount:string}>('select amount from public.credit_installments')).rows[0].amount)).toBe(900.25)
  })
  it('rejects future and pre-contract payment dates even with a linked open cash movement',async()=>{
    await pay(); await linkCash()
    await expect(amend({action:'correct_payment_date',paymentId:payment,paidAt:new Date(Date.now()+86400000).toISOString()})).rejects.toThrow('AMEND_PAYMENT_DATE')
    await expect(amend({action:'correct_payment_date',paymentId:payment,paidAt:'2000-01-01T12:00:00Z'})).rejects.toThrow('AMEND_PAYMENT_DATE')
  })
  it('does not bypass the existing credit-file approval when increasing debt',async()=>{
    await db.exec(`insert into public.organization_credit_file_policies values('${org}','required')`)
    await expect(amend({action:'adjust_balance',installmentId:inst,amount:1200})).rejects.toThrow('CREDIT_FILE_REQUIRED')
    expect((await snapshot()).history).toHaveLength(0)
    await amend({action:'adjust_balance',installmentId:inst,amount:900})
    expect((await snapshot()).history).toHaveLength(1)
  })
  it('rolls back the whole reschedule if a later installment is invalid',async()=>{
    const before=await snapshot()
    await expect(amend({action:'reschedule',installments:[{id:inst,dueDate:'2026-12-15'},{id:id(99),dueDate:'2026-12-16'}]})).rejects.toThrow('AMEND_INSTALLMENT')
    expect((await snapshot()).version).toBe(before.version)
    expect((await snapshot()).history).toHaveLength(0)
  })
  it('corrects completion time of a fully paid credit without reopening or changing its balance',async()=>{
    await pay(1000); await linkCash()
    await db.exec('update public.cash_movements set amount=1000')
    const date=paidAt()
    await amend({action:'correct_payment_date',paymentId:payment,paidAt:date})
    const row=(await db.query<{status:string;same:boolean;paid:string}>(`select c.status,i.paid_at=p.created_at as same,i.amount_paid as paid from public.customer_credits c join public.credit_installments i on i.credit_id=c.id join public.credit_payments p on p.installment_id=i.id`)).rows[0]
    expect(row).toEqual({status:'completed',same:true,paid:'1000'})
  })
})
