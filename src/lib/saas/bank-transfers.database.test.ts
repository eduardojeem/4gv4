/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, expect, it } from 'vitest'
const db = new PGlite()
const owner='00000000-0000-0000-0000-000000000001', admin='00000000-0000-0000-0000-000000000002', superadmin='00000000-0000-0000-0000-000000000003'
const org='10000000-0000-0000-0000-000000000001', other='10000000-0000-0000-0000-000000000002'
async function call(name:string,args:unknown[]){const r=await db.query<{result:any}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args);return r.rows[0].result}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
 create table organizations(id uuid primary key,plan text,updated_at timestamptz);
 create table profiles(id uuid primary key,role text,status text);
 create table user_roles(user_id uuid primary key,role text,is_active boolean);
 create table organization_members(organization_id uuid,user_id uuid,role text,status text);
 create table plans(code text primary key,is_active boolean);
 create table subscription_plans(tier text primary key,name text,price numeric,is_active boolean);
 create table subscriptions(id uuid primary key default gen_random_uuid(),organization_id uuid unique,plan text,status text,provider text,payment_status text,last_payment_method text,started_at timestamptz,trial_ends_at timestamptz,current_period_starts_at timestamptz,current_period_ends_at timestamptz,cancel_at_period_end boolean,external_reference text,updated_at timestamptz);
 create table subscription_payments(id uuid primary key default gen_random_uuid(),organization_id uuid,subscription_id uuid,plan_id text,amount numeric,currency text,status text,payment_method text,provider text,provider_payment_id text,external_reference text,paid_at timestamptz);
 create table tenant_audit_log(id uuid default gen_random_uuid(),organization_id uuid,user_id uuid,action text,resource text,resource_id text,metadata jsonb);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
 grant usage on schema public,storage to service_role,authenticated,anon;grant all on all tables in schema public,storage to service_role;
 insert into organizations values('${org}','BASIC',now()),('${other}','FREE',now());
 insert into profiles values('${owner}','user','active'),('${admin}','user','active'),('${superadmin}','super_admin','active');
 insert into user_roles values('${superadmin}','super_admin',true);
 insert into organization_members values('${org}','${owner}','owner','active'),('${org}','${admin}','admin','active'),('${other}','${owner}','owner','active');
 insert into plans values('BASIC',true),('PRO',true);insert into subscription_plans values('basic','Basico',100000,true),('pro','Pro',200000,true);
 insert into subscriptions(organization_id,plan,status,payment_status,current_period_ends_at) values('${org}','BASIC','active',null,'2030-01-31 12:00:00-03');`)
 await db.exec(readFileSync('supabase/migrations/20261018232327_subscription_bank_transfers.sql','utf8'))
 await db.exec('set role service_role')
 await call('update_subscription_bank_transfer_settings',[superadmin,{enabled:true,bankName:'Banco',accountHolder:'Titular',accountNumber:'123',accountAlias:'',currency:'PYG',instructions:''}])
},30000)
afterAll(()=>db.close())
it('requires an explicit active superadmin role rather than a profile label alone', async()=>{
 const profileOnly='00000000-0000-0000-0000-000000000009'
 await db.query("insert into profiles values($1,'super_admin','active')",[profileOnly])
 await expect(call('update_subscription_bank_transfer_settings',[profileOnly,{enabled:false,currency:'PYG'}])).rejects.toThrow('TRANSFER_SUPERADMIN_REQUIRED')
})
it('enforces authorization, immutable pricing, one open request, calendar renewal and idempotency',async()=>{
 await expect(call('create_subscription_bank_transfer',[org,admin,'PRO'])).rejects.toThrow('TRANSFER_OWNER_REQUIRED')
 await expect(call('create_subscription_bank_transfer',[org,owner,'PRO'])).rejects.toThrow('TRANSFER_PLAN_NOT_ELIGIBLE')
 const [a,b]=await Promise.all([call('create_subscription_bank_transfer',[org,admin,'BASIC']),call('create_subscription_bank_transfer',[org,owner,'BASIC'])])
 expect(a.id).toBe(b.id);expect(a.amount).toBe(100000)
 await db.exec("update subscription_plans set price=120000 where tier='basic'")
 const path=`${org}/${a.id}/receipt.pdf`
 await db.query("insert into storage.objects values('subscription-transfer-receipts',$1,$2)",[path,{mimetype:'application/pdf',size:100}])
 await expect(call('submit_subscription_bank_transfer_receipt',[other,owner,a.id,path,'application/pdf',100,null])).rejects.toThrow('TRANSFER_NOT_FOUND')
 await call('submit_subscription_bank_transfer_receipt',[org,owner,a.id,path,'application/pdf',100,null])
 await expect(call('review_subscription_bank_transfer',[owner,a.id,'approved',null,'operation'])).rejects.toThrow('TRANSFER_SUPERADMIN_REQUIRED')
 const result=await call('review_subscription_bank_transfer',[superadmin,a.id,'approved',null,' OP 123 '])
 expect(result.applied).toBe(true);expect(result.request.amount).toBe(100000)
 expect(result.request.period_starts_at).toContain('2030-01-31');expect(result.request.period_ends_at).toContain('2030-02-28')
 const replay=await call('review_subscription_bank_transfer',[superadmin,a.id,'approved',null,'op123']);expect(replay.applied).toBe(false)
 expect((await db.query<{n:number}>('select count(*)::int n from subscription_payments')).rows[0].n).toBe(1)
 const next=await call('create_subscription_bank_transfer',[other,owner,'BASIC']);const second=`${other}/${next.id}/receipt.pdf`
 await db.query("insert into storage.objects values('subscription-transfer-receipts',$1,$2)",[second,{mimetype:'application/pdf',size:100}])
 await call('submit_subscription_bank_transfer_receipt',[other,owner,next.id,second,'application/pdf',100,null])
 await expect(call('review_subscription_bank_transfer',[superadmin,next.id,'approved',null,'OP123'])).rejects.toThrow('TRANSFER_DUPLICATE_OPERATION')
 expect((await db.query<{plan:string}>('select plan from organizations where id=$1',[other])).rows[0].plan).toBe('FREE')
 await expect(call('review_subscription_bank_transfer',[superadmin,next.id,'rejected','',null])).rejects.toThrow('TRANSFER_REJECTION_REASON_REQUIRED')
 await call('review_subscription_bank_transfer',[superadmin,next.id,'rejected','Documento incorrecto',null])
 const fresh=await call('create_subscription_bank_transfer',[other,owner,'PRO']);expect(fresh.id).not.toBe(next.id)
 const freshPath=`${other}/${fresh.id}/receipt.pdf`
 await db.query("insert into storage.objects values('subscription-transfer-receipts',$1,$2)",[freshPath,{mimetype:'application/pdf',size:100}])
 await call('submit_subscription_bank_transfer_receipt',[other,owner,fresh.id,freshPath,'application/pdf',100,null])
 await db.exec("update plans set is_active=false where code='PRO'")
 await expect(call('review_subscription_bank_transfer',[superadmin,fresh.id,'approved',null,'newop'])).rejects.toThrow('TRANSFER_PLAN_NOT_ELIGIBLE')
 await db.exec(`update profiles set status='suspended' where id='${superadmin}'`)
 await expect(call('review_subscription_bank_transfer',[superadmin,fresh.id,'rejected','No',null])).rejects.toThrow('TRANSFER_FORBIDDEN')
 await db.exec(`update profiles set status='active' where id='${superadmin}'`)
 await db.exec("reset role;grant select on storage.objects to authenticated;create policy legacy_permissive on storage.objects for select to authenticated using(true)")

 await db.exec('set role service_role')
 const abandoned=await call('create_subscription_bank_transfer',[org,owner,'BASIC'])
 await expect(call('review_subscription_bank_transfer',[superadmin,abandoned.id,'approved',null,'notpaid'])).rejects.toThrow('TRANSFER_INVALID_STATE')
 await call('review_subscription_bank_transfer',[superadmin,abandoned.id,'rejected','Actualizar cuenta bancaria',null])
 await call('update_subscription_bank_transfer_settings',[superadmin,{enabled:true,bankName:'Banco nuevo',accountHolder:'Titular',accountNumber:'456',accountAlias:'',currency:'PYG',instructions:''}])
 const replacement=await call('create_subscription_bank_transfer',[org,owner,'BASIC'])
 expect(replacement.id).not.toBe(abandoned.id);expect(replacement.bank_snapshot.accountNumber).toBe('456')
 expect((await db.query<{n:number}>('select count(*)::int n from subscription_payments')).rows[0].n).toBe(1)
 await db.query("update subscriptions set status='trialing',trial_ends_at='2031-03-15 12:00:00-03',current_period_ends_at=null where organization_id=$1",[org])
 const trialPath=`${org}/${replacement.id}/trial.pdf`
 await db.query("insert into storage.objects values('subscription-transfer-receipts',$1,$2)",[trialPath,{mimetype:'application/pdf',size:100}])
 await call('submit_subscription_bank_transfer_receipt',[org,owner,replacement.id,trialPath,'application/pdf',100,null])
 const paidTrial=await call('review_subscription_bank_transfer',[superadmin,replacement.id,'approved',null,'trial-operation'])
 expect(paidTrial.request.period_starts_at).toContain('2031-03-15')
 expect(paidTrial.request.period_ends_at).toContain('2031-04-15')
 await db.exec('reset role;set role authenticated')
 await expect(call('create_subscription_bank_transfer',[org,owner,'BASIC'])).rejects.toThrow('permission denied')
 expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
 await db.exec('reset role;set role service_role')
},30000)

