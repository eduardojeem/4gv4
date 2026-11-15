// @vitest-environment node
import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest'
const db=new PGlite()
const org='00000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000002',prof='00000000-0000-4000-8000-000000000003',other='00000000-0000-4000-8000-000000000004'
const original=readFileSync('supabase/migrations/20261014120002_agenda_booking_atomic.sql','utf8')
function definition(sql:string,name:string){const start=sql.search(new RegExp('create (?:or replace )?function public\\.'+name+'\\('));if(start<0)throw Error(name);return sql.slice(start,sql.indexOf('$$;',start)+3)}
const input=(patch={})=>({customer_name:'Cliente de prueba',professional_id:prof,service_name:'Visita',price:50000,starts_at:'2026-11-16T10:00:00Z',duration_minutes:30,attention_mode:'home',service_address:'Calle 1, Asunción',travel_before_minutes:15,travel_after_minutes:20,...patch})
const save=(patch={},id:string|null=null,tenant=org,user=actor)=>db.query<{result:Record<string,unknown>}>('select save_agenda_home_appointment($1,$2,$3,$4) as result',[tenant,id,input(patch),user])
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table organizations(id uuid primary key);
 create table organization_members(organization_id uuid,user_id uuid,status text,role text);
 create table organization_settings(organization_id uuid,timezone text);
 create table agenda_professionals(id uuid primary key,organization_id uuid,name text,is_active boolean,opening_hours jsonb);
 create table products(id uuid,organization_id uuid,unit_measure text,is_active boolean,sale_price numeric,name text);
 create table customers(id uuid,organization_id uuid);
 create table agenda_services(organization_id uuid,product_id uuid,duration_minutes integer,buffer_minutes integer);
 create table agenda_professional_service_rates(organization_id uuid,professional_id uuid,product_id uuid,price numeric,duration_minutes integer,buffer_minutes integer);
 create table agenda_professional_services(organization_id uuid,professional_id uuid,product_id uuid);
 create table agenda_settings(organization_id uuid,slot_minutes integer,opening_hours jsonb);
 create table agenda_booking_quotes(id uuid);
 create table agenda_time_off(id uuid primary key default gen_random_uuid(),organization_id uuid,professional_id uuid,starts_at timestamptz,ends_at timestamptz);
 create table appointments(id uuid primary key default gen_random_uuid(),organization_id uuid,professional_id uuid,customer_id uuid,customer_name text,customer_phone text,service_product_id uuid,service_name text,price numeric,starts_at timestamptz,ends_at timestamptz,buffer_minutes integer not null default 0,occupied_until timestamptz,status text,sale_id uuid,confirmed_at timestamptz,source text,notes text,created_by uuid,reminder_sent_at timestamptz, constraint appointments_occupied_interval check(occupied_until=ends_at+make_interval(mins=>buffer_minutes)));
 insert into organizations values('${org}'),('${other}');insert into organization_members values('${org}','${actor}','active','owner');
 insert into organization_settings values('${org}','UTC');insert into agenda_professionals values('${prof}','${org}','Profesional',true,null);
 insert into agenda_settings values('${org}',30,'{"1":[["08:00","18:00"]]}'::jsonb);`)
 await db.exec(definition(original,'agenda_lock'))
 await db.exec(definition(original,'agenda_assert_actor'))
 await db.exec(definition(original,'agenda_time_is_open'))
 await db.exec(definition(original,'check_appointment_overlap'))
 await db.exec(definition(original,'agenda_time_off_guard'))
 await db.exec(definition(original,'create_agenda_quote'))
 await db.exec(definition(readFileSync('supabase/migrations/20261014120001_agenda_professional_booking.sql','utf8'),'set_appointment_occupied_until'))
 await db.exec(`create trigger appointments_00_occupied_until before insert or update on appointments for each row execute function set_appointment_occupied_until();create trigger appointments_10_overlap before insert or update on appointments for each row execute function check_appointment_overlap();create trigger agenda_time_off_guard before insert or update or delete on agenda_time_off for each row execute function agenda_time_off_guard();`)
 await db.exec(definition(original,'save_agenda_appointment'))
 await db.exec(readFileSync('supabase/migrations/20261014120004_agenda_accepted_terms.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261115023522_business_primary_and_home_appointments.sql','utf8'))
},30000)
beforeEach(async()=>{await db.exec('truncate appointments,agenda_time_off')})
afterAll(async()=>{await db.close()})
it('saves address and blocks both travel intervals without changing the service price',async()=>{const row=(await save()).rows[0].result;expect(row).toMatchObject({attention_mode:'home',service_address:'Calle 1, Asunción',travel_before_minutes:15,travel_after_minutes:20});expect(Date.parse(String(row.starts_at))-Date.parse(String(row.occupied_from))).toBe(15*60000);expect(Date.parse(String(row.occupied_until))-Date.parse(String(row.ends_at))).toBe(20*60000);expect(Number(row.price)).toBe(50000)})
it('rejects service overlap with travel before and after, rolling back writes',async()=>{await save();await expect(save({attention_mode:'local',starts_at:'2026-11-16T09:30Z',travel_before_minutes:0,travel_after_minutes:0})).rejects.toThrow('APPOINTMENT_OVERLAP');await expect(save({attention_mode:'local',starts_at:'2026-11-16T10:30Z',travel_before_minutes:0,travel_after_minutes:0})).rejects.toThrow('APPOINTMENT_OVERLAP');expect((await db.query('select count(*)::int as count from appointments')).rows[0]).toEqual({count:1})})
it('rejects an absence over the travel interval',async()=>{await save();await expect(db.query('insert into agenda_time_off(organization_id,professional_id,starts_at,ends_at) values($1,$2,$3,$4)',[org,prof,'2026-11-16T09:45Z','2026-11-16T09:55Z'])).rejects.toThrow('TIME_OFF_CONFLICT')})
it('checks full trip against business opening hours',async()=>{await expect(save({starts_at:'2026-11-16T08:00Z'})).rejects.toThrow('HOME_TRAVEL_OUTSIDE_HOURS');await expect(save({starts_at:'2026-11-16T17:30Z'})).rejects.toThrow('HOME_TRAVEL_OUTSIDE_HOURS')})
it('updates time and modality atomically without retaining travel from the previous visit',async()=>{const row=(await save()).rows[0].result;const updated=(await save({attention_mode:'local',starts_at:'2026-11-16T08:00Z',travel_before_minutes:0,travel_after_minutes:0},String(row.id))).rows[0].result;expect(updated).toMatchObject({attention_mode:'local',service_address:null,travel_before_minutes:0,travel_after_minutes:0})})
it('rejects a foreign tenant and protects paid home details',async()=>{await expect(save({},null,other)).rejects.toThrow('ACTOR_NOT_AUTHORIZED');const row=(await save()).rows[0].result;await db.query('update appointments set sale_id=$1 where id=$2',[actor,row.id]);await expect(db.query('update appointments set service_address=$1 where id=$2',['Otra calle',row.id])).rejects.toThrow('APPOINTMENT_ALREADY_PAID')})
it('does not expose privileged writers and preserves the accepted-terms wrapper',async()=>{expect((await db.query("select has_function_privilege('authenticated','save_agenda_home_appointment(uuid,uuid,jsonb,uuid)','execute') as allowed")).rows[0]).toEqual({allowed:false});const row=(await save()).rows[0].result;await expect(save({professional_id:null},String(row.id))).rejects.toThrow('NEW_TERMS_ACCEPTANCE_REQUIRED')})
it('allows normal authorized status updates through the database trigger',async()=>{const row=(await save({status:'pending'})).rows[0].result;await db.exec('grant select on appointments to authenticated;grant update(status) on appointments to authenticated;set role authenticated');try{await db.query("update appointments set status='confirmed' where id=$1",[row.id])}finally{await db.exec('reset role')}expect((await db.query('select status from appointments where id=$1',[row.id])).rows[0]).toEqual({status:'confirmed'})});

it('preserves home data when an older client edits through the previous writer',async()=>{const row=(await save()).rows[0].result;const legacy={customer_name:'Cliente de prueba',professional_id:prof,service_name:'Visita',price:50000,starts_at:'2026-11-16T11:00Z',duration_minutes:30};const updated=(await db.query<{result:Record<string,unknown>}>('select save_agenda_appointment($1,$2,$3,$4) as result',[org,row.id,legacy,actor])).rows[0].result;expect(updated).toMatchObject({attention_mode:'home',service_address:'Calle 1, Asunción',travel_before_minutes:15,travel_after_minutes:20})});
