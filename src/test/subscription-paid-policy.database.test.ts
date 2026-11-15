// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,it,expect} from 'vitest';
const db=new PGlite();
const org='10000000-0000-4000-8000-000000000001';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table organizations(id uuid primary key,plan text,updated_at timestamptz);
 create table plans(code text primary key,is_active boolean);
 create table subscription_plans(tier text primary key,price numeric,is_active boolean);
 create table subscriptions(organization_id uuid unique,plan text,status text,payment_status text,cancel_at_period_end boolean,current_period_starts_at timestamptz,current_period_ends_at timestamptz,trial_ends_at timestamptz,updated_at timestamptz);
 insert into plans values('FREE',true),('BASIC',true),('ENTERPRISE',false);
 insert into subscription_plans values('free',50000,true),('basic',120000,true),('enterprise',300000,false);
 insert into organizations values('${org}','FREE',now());`);
 await db.exec(readFileSync('supabase/migrations/20261112215428_subscription_paid_plan_consistency.sql','utf8'));
},30000);
afterAll(()=>db.close());
beforeEach(async()=>{await db.exec('delete from subscriptions;');});
async function subscription(plan:string,status:string,ends:string){await db.query('insert into subscriptions(organization_id,plan,status,payment_status,current_period_ends_at,updated_at) values($1,$2,$3,$4,$5,now())',[org,plan,status,'paid',ends]);}
it('suspends paid FREE without changing either plan identity',async()=>{
 await subscription('FREE','active','2020-01-01');await db.exec('select expire_paid_periods()');
 const row=(await db.query('select plan,status from subscriptions')).rows[0];expect(row).toEqual({plan:'FREE',status:'suspended'});
 expect((await db.query('select plan from organizations')).rows[0]).toEqual({plan:'FREE'});
});
it('keeps future paid access and does not reopen suspended accounts',async()=>{
 await subscription('BASIC','active','2099-01-01');await db.exec('select expire_paid_periods();select downgrade_overdue_accounts();');
 expect((await db.query('select status from subscriptions')).rows[0]).toEqual({status:'active'});
 await db.exec("update subscriptions set status='suspended';select downgrade_overdue_accounts();");
 expect((await db.query('select status from subscriptions')).rows[0]).toEqual({status:'suspended'});
});
it('keeps retired plan customers on their original code when expired',async()=>{
 await subscription('ENTERPRISE','active','2020-01-01');await db.exec('select expire_paid_periods()');
 expect((await db.query('select plan,status from subscriptions')).rows[0]).toEqual({plan:'ENTERPRISE',status:'suspended'});
});
it('suspends overdue and trials instead of moving them to a paid base plan',async()=>{
 await subscription('BASIC','past_due','2020-01-01');await db.exec('select downgrade_overdue_accounts()');
 expect((await db.query('select plan,status from subscriptions')).rows[0]).toEqual({plan:'BASIC',status:'suspended'});
 await db.exec("update subscriptions set status='trialing',trial_ends_at='2020-01-01';select expire_trials();");
 expect((await db.query('select status from subscriptions')).rows[0]).toEqual({status:'suspended'});
});
it('refuses to activate the paid BASIC legacy FREE code without payment',async()=>{
 await expect(db.query('select apply_free_subscription_plan($1,$2)',[org,'FREE'])).rejects.toThrow(/precio cero/);
 expect((await db.query('select * from subscriptions')).rows).toHaveLength(0);
});
it('does not expose lifecycle mutations to authenticated clients',async()=>{
 const result=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.apply_free_subscription_plan(uuid,text)','execute') as allowed");
 expect(result.rows[0].allowed).toBe(false);
});
