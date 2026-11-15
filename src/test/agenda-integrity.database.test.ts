// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest'
const db=new PGlite()
const org='10000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001',prof='30000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000002'
const input=(patch={})=>({professionalId:prof,receiptCode:'LIQ-test',periodPreset:'today',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash',...patch})
const pay=(patch={})=>db.query<{result:Record<string,unknown>}>('select save_agenda_settlement_checked($1,$2,$3) as result',[org,actor,input(patch)])
beforeAll(async()=>{
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now());
create table organizations(id uuid primary key);
create table organization_members(organization_id uuid,user_id uuid,role text,status text,unique(organization_id,user_id));
create table organization_settings(organization_id uuid,timezone text);
create table agenda_professionals(id uuid primary key,organization_id uuid,name text,user_id uuid);
create table cash_registers(id uuid,organization_id uuid,branch_id uuid,is_active boolean);
create table cash_closures(id uuid,organization_id uuid,branch_id uuid,register_id text,date date);
create table cash_movements(id uuid primary key default gen_random_uuid(),organization_id uuid,branch_id uuid,session_id uuid,type text,amount numeric);
create table appointments(id uuid default gen_random_uuid(),organization_id uuid,professional_id uuid,status text,starts_at timestamptz,price numeric);
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create function assert_service_cash_actor(uuid) returns void language plpgsql as $$begin if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if; end$$;
create function server_record_cash_movement_atomic(p_actor uuid,p_org uuid,p_branch uuid,p_session uuid,p_type text,p_amount numeric,p_reason text) returns jsonb language plpgsql as $$declare movement cash_movements%rowtype; begin
if not exists(select 1 from cash_closures where id=p_session and organization_id=p_org and date is null) then raise exception 'OPEN_CASH_SESSION_NOT_FOUND'; end if;
insert into cash_movements(organization_id,branch_id,session_id,type,amount) values(p_org,p_branch,p_session,p_type,p_amount) returning * into movement; return to_jsonb(movement); end$$;`)
await db.exec(readFileSync('supabase/migrations/20261113000000_barber_commissions.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20261113215854_agenda_integrity_and_admin_invites.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20261113222022_agenda_settlement_admin_audit.sql','utf8'))
await db.exec(`alter table agenda_professional_settlements add check(notes is distinct from 'reject');`)
},30000)
afterAll(()=>db.close())
beforeEach(async()=>{await db.exec(`set request.jwt.claim.role='service_role';delete from agenda_professional_settlements;delete from cash_movements;delete from appointments;delete from cash_closures;delete from cash_registers;delete from agenda_professionals;delete from organization_members;delete from organization_settings;delete from auth.users;delete from organizations;
insert into organizations values('${org}');insert into auth.users(id,email) values('${actor}','admin@example.com');insert into organization_members values('${org}','${actor}','admin','active');insert into organization_settings values('${org}','America/Asuncion');
insert into agenda_professionals(id,organization_id,name,commission_rate_services) values('${prof}','${org}','Ana',50);
insert into cash_registers values('${prof}','${org}','${actor}',true);insert into cash_closures values('${prof}','${org}','${actor}','${prof}',null);
insert into appointments(organization_id,professional_id,status,starts_at,price) values('${org}','${prof}','completed','2026-11-13T13:00Z',100000),('${org}','${prof}','pending','2026-11-13T14:00Z',900000);`)});
it('recalculates from completed appointments and ignores forged client totals',async()=>{const row=(await pay({totalBilled:999999,commissionRate:100,professionalName:'Forged'})).rows[0].result;expect(Number(row.net_amount)).toBe(50000);expect(Number(row.total_billed)).toBe(100000);expect(row.professional_name).toBe('Ana')})
it('rolls back the cash out if persisting the settlement fails',async()=>{await expect(pay({notes:'reject'})).rejects.toThrow();expect((await db.query('select count(*)::int as n from cash_movements')).rows[0]).toEqual({n:0})})
it('does not pay without an open cash session',async()=>{await db.exec('delete from cash_closures');await expect(pay()).rejects.toThrow('SETTLEMENT_CASH_SESSION_REQUIRED');expect((await db.query('select count(*)::int as n from agenda_professional_settlements')).rows[0]).toEqual({n:0})})
it('a retry returns the existing receipt without a second cash out',async()=>{await pay();await pay();expect((await db.query('select count(*)::int as n from cash_movements')).rows[0]).toEqual({n:1})})
it('rejects forged amounts, outsiders and non-admin actors',async()=>{await expect(pay({netAmount:999999})).rejects.toThrow('SETTLEMENT_CHANGED');await expect(pay({professionalId:other})).rejects.toThrow('PROFESSIONAL_NOT_FOUND');await db.exec("update organization_members set role='seller'");await expect(pay()).rejects.toThrow('ACTOR_NOT_AUTHORIZED')})
it('cancellation creates one reversal, and repeats are idempotent',async()=>{const saved=(await pay()).rows[0].result;await db.query('select cancel_agenda_settlement_checked($1,$2,$3,$4)',[org,actor,saved.id,'Pago por error']);await db.query('select cancel_agenda_settlement_checked($1,$2,$3,$4)',[org,actor,saved.id,'Pago por error']);expect((await db.query('select sum(case when type=\'cash_out\' then -amount else amount end)::float as balance from cash_movements')).rows[0]).toEqual({balance:0})})
it('closed original cash session prevents cancellation without changing paid status',async()=>{const saved=(await pay()).rows[0].result;await db.exec("update cash_closures set date='2026-11-13'");await expect(db.query('select cancel_agenda_settlement_checked($1,$2,$3,$4)',[org,actor,saved.id,'Pago por error'])).rejects.toThrow('OPEN_CASH_SESSION_NOT_FOUND');expect((await db.query('select status from agenda_professional_settlements')).rows[0]).toEqual({status:'paid'})})
it('rejects overlapping periods so an unrelated payment cannot erase or duplicate a balance',async()=>{await pay();await expect(pay({receiptCode:'LIQ-other',periodFrom:'2026-11-12'})).rejects.toThrow('SETTLEMENT_PERIOD_OVERLAP')})
it('tips paid earlier do not consume the service commission balance',async()=>{await pay({tipsAmount:10000,netAmount:60000});await db.exec(`insert into appointments(organization_id,professional_id,status,starts_at,price) values('${org}','${prof}','completed','2026-11-13T15:00Z',20000)`);const saved=(await pay({receiptCode:'LIQ-second',netAmount:10000})).rows[0].result;expect(Number(saved.net_amount)).toBe(10000);expect(Number(saved.appointments_count)).toBe(1)})
it('existing employee roles are preserved and other accounts cannot be linked',async()=>{await db.query('select link_agenda_employee_checked($1,$2,$3,$4,$5,false)',[org,prof,actor,'admin@example.com',actor]);expect((await db.query('select role from organization_members')).rows[0]).toEqual({role:'admin'});await db.exec(`insert into auth.users(id,email) values('${other}','outsider@example.com')`);await expect(db.query('select link_agenda_employee_checked($1,$2,$3,$4,$5,false)',[org,prof,other,'outsider@example.com',actor])).rejects.toThrow()})
it('privileged RPCs and financial table writes are denied to browser roles',async()=>{expect((await db.query("select has_function_privilege('authenticated','save_agenda_settlement_checked(uuid,uuid,jsonb)','execute') as allowed")).rows[0]).toEqual({allowed:false});expect((await db.query("select has_table_privilege('authenticated','agenda_professional_settlements','insert') as allowed")).rows[0]).toEqual({allowed:false})})
it('service-only invite lookup works without exposing auth.users to the browser',async()=>{
  await db.exec('set role service_role')
  try { const result=await db.query<{result:{user_id:string}}>('select agenda_invite_target($1,$2,$3,$4) as result',[org,prof,'admin@example.com',actor]);expect(result.rows[0].result.user_id).toBe(actor) }
  finally {await db.exec('reset role')}
})
it('stores cancellation actor, time and reason in the transaction',async()=>{
 const saved=(await pay()).rows[0].result
 const result=await db.query<{result:Record<string,unknown>}>('select cancel_agenda_settlement_checked($1,$2,$3,$4) as result',[org,actor,saved.id,'Importe duplicado'])
 expect(result.rows[0].result).toMatchObject({cancelled_by:actor,cancellation_reason:'Importe duplicado',status:'cancelled'})
 expect(result.rows[0].result.cancelled_at).toBeTruthy()
})
it('rejects suspended administrative membership and a missing cancellation reason',async()=>{
 const saved=(await pay()).rows[0].result
 await expect(db.query('select cancel_agenda_settlement_checked($1,$2,$3,$4)',[org,actor,saved.id,''])).rejects.toThrow('SETTLEMENT_REASON_REQUIRED')
 await db.exec("update organization_members set status='suspended'")
 await expect(pay({receiptCode:'LIQ-new'})).rejects.toThrow('ACTOR_NOT_AUTHORIZED')
})
