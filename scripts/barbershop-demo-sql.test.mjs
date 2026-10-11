import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { setupPosFixture } from './agenda-pos-db-fixture.mjs'

const db = new PGlite()
const org = '11111111-1111-4111-8111-111111111111'
const actor = '55555555-5555-4555-8555-555555555555'
let seed
before(async () => {
  seed = await readFile(new URL('../supabase/examples/jesentrix_barberia_dev.sql', import.meta.url), 'utf8')
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create table organizations(id uuid primary key,name text,business_vertical text);
    create table organization_members(organization_id uuid,user_id uuid,status text,role text);
    create table products(id uuid primary key,organization_id uuid references organizations(id),sku text unique,name text,sale_price numeric,unit_measure text,is_active boolean,visibility text,hide_price boolean default false,purchase_price numeric,min_stock int,archived_by_plan_at timestamptz);
    create table customers(id uuid primary key,organization_id uuid references organizations(id),phone_digits text);
    create table organization_settings(organization_id uuid primary key,timezone text,currency text);
    create table plans(id int); create table subscription_plans(id int); create table subscriptions(organization_id uuid); create table organization_module_trials(organization_id uuid);
    create table tenant_audit_log(organization_id uuid,user_id uuid,action text,resource text,resource_id text,metadata jsonb);
    create function get_org_role(uuid) returns text language sql as $$select 'owner'$$;
    create function has_org_permission(uuid,text) returns boolean language sql as $$select true$$;
    create function assign_document_number() returns trigger language plpgsql as $$begin new.number:=coalesce((select max(number) from public.appointments where organization_id=new.organization_id),0)+1;return new;end$$;
    create function touch_document_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=now();return new;end$$;
    insert into organizations values('${org}','Barbería test','barbershop');
    insert into auth.users values('${actor}','jesentrix@gmail.com');
    insert into organization_members values('${org}','${actor}','active','owner');
    insert into organization_settings values('${org}','America/Asuncion','PYG');`)
  // Existing fixture supplies financial dependencies for actual booking SQL.
  // Peripheral auth/plan tables are simplified: not remote Supabase proof.
  await setupPosFixture(db, org)
  for (const name of ['20261009120000_agenda_appointments.sql','20261011120000_agenda_professional_services.sql','20261012120000_agenda_professional_profile.sql','20261013120000_appointment_events.sql','20261014120001_agenda_professional_booking.sql','20261014120002_agenda_booking_atomic.sql','20261014120004_agenda_accepted_terms.sql','20261014120007_agenda_service_creation_atomic.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
  }
})
after(async () => { await db.close() })
const run = async (sql) => { try { await db.exec(sql) } catch (error) { await db.exec('rollback'); throw error } }

test('production example requires confirmation and preserves bookings and settings', async () => {
  const production = await readFile(new URL('../supabase/examples/jesentrix_barberia_produccion.sql', import.meta.url), 'utf8')
  await assert.rejects(run(production), /CONFIRMAR_PRODUCCION/)
  const confirmed = production.replace('v_confirm_production boolean := false', 'v_confirm_production boolean := true')
  await assert.rejects(run(confirmed), /EMPRESA_Y_LIMITE/)
  await db.exec(`insert into agenda_settings(organization_id) values('${org}')`)
  const configured = confirmed.replace('v_requested_org uuid := null', `v_requested_org uuid := '${org}'`)
    .replace('v_verified_service_limit integer := 0', 'v_verified_service_limit integer := 50')
  const transactionBody = configured.slice(configured.indexOf('begin;'), configured.lastIndexOf('commit;'))
  // Execute twice inside one transaction, verify real RPC writes, then discard fixture data.
  await db.exec(transactionBody)
  await db.exec(transactionBody.slice(transactionBody.indexOf('do $demo$')))
  for (const [table,total] of [['products',6],['agenda_professionals',2],['agenda_professional_service_rates',4],['appointments',0],['sales',0],['cash_movements',0]]) {
    assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,total)
  }
  assert.equal((await db.query('select count(*)::int n from agenda_professionals where is_active or online_visible')).rows[0].n,0)
  assert.equal((await db.query("select count(*)::int n from products where visibility='public'")).rows[0].n,0)
  await db.exec('rollback')
})
test('requires development confirmation before writing anything', async () => {
  await assert.rejects(run(seed), /CONFIRMAR_DESARROLLO/)
  assert.equal((await db.query('select count(*)::int n from products')).rows[0].n,0)
})
test('creates repeatable barber data without touching money or publishing', async () => {
  const confirmed = seed.replace('v_confirm_development boolean := false','v_confirm_development boolean := true')
  await run(confirmed)
  await db.exec('update agenda_settings set slot_minutes=20')
  await run(confirmed)
  for (const [table,total] of [['products',6],['agenda_professionals',2],['appointments',6],['agenda_professional_service_rates',4]]) {
    assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,total)
  }
  assert.equal((await db.query('select slot_minutes from agenda_settings')).rows[0].slot_minutes,20)
  assert.equal((await db.query("select count(*)::int n from products where visibility='public'")).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from sales')).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from cash_movements')).rows[0].n,0)
  assert.equal((await db.query("select count(*)::int n from appointments where status='confirmed' and customer_phone is null")).rows[0].n,6)
})
test('rejects multiple eligible organizations rather than choosing one', async () => {
  await db.exec(`insert into organizations values('99999999-9999-4999-8999-999999999999','Other','barbershop');insert into organization_members values('99999999-9999-4999-8999-999999999999','${actor}','active','owner')`)
  await assert.rejects(run(seed.replace('v_confirm_development boolean := false','v_confirm_development boolean := true')), /ORGANIZACION_AMBIGUA/)
})
