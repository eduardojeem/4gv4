import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setupPosFixture,branch,session } from './agenda-pos-db-fixture.mjs'

const db = new PGlite()
const org = '11111111-1111-4111-8111-111111111111'
const prof = '22222222-2222-4222-8222-222222222222'
const product = '33333333-3333-4333-8333-333333333333'
const key = '44444444-4444-4444-8444-444444444444'
const actor = '55555555-5555-4555-8555-555555555555'
const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T09:00:00Z'
const customer = { name: 'Cliente', phone: '0981000000', notes: null }
before(async () => {
  // Isolated PostgreSQL fixture: no Supabase credentials and no remote writes.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table organizations(id uuid primary key);
    create table organization_members(organization_id uuid, user_id uuid, status text, role text);
    create table products(id uuid primary key, organization_id uuid references organizations(id), name text, sale_price numeric, unit_measure text, is_active boolean, visibility text, hide_price boolean);
    create table customers(id uuid primary key, organization_id uuid references organizations(id), phone_digits text);
    create table organization_settings(organization_id uuid primary key, timezone text, currency text);
    create function get_org_role(uuid) returns text language sql as $$ select case when current_setting('test.org', true) = $1::text then 'owner' end $$;
    create function has_org_permission(uuid,text) returns boolean language sql as $$ select get_org_role($1) = 'owner' $$;
    create function assign_document_number() returns trigger language plpgsql as $$ begin new.number := coalesce((select max(number) from public.appointments where organization_id = new.organization_id),0)+1; return new; end $$;
    create function touch_document_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
    insert into organizations values ('${org}');
    insert into auth.users values ('${actor}');
    insert into organization_members values ('${org}','${actor}','active','owner');
    insert into products values ('${product}','${org}','Corte',30000,'servicio',true,'public',false);
    insert into organization_settings values ('${org}','UTC','PYG');
  `)
  await setupPosFixture(db,org)
  for (const file of ['20261009120000_agenda_appointments.sql', '20261011120000_agenda_professional_services.sql', '20261012120000_agenda_professional_profile.sql', '20261013120000_appointment_events.sql', '20261014120001_agenda_professional_booking.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'))
  }
  const { readdir } = await import('node:fs/promises')
  const migration = (await readdir(new URL('../supabase/migrations/', import.meta.url))).find(name => name.endsWith('_agenda_booking_atomic.sql'))
  if (migration) await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
  const posMigration=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(name=>name.endsWith('_agenda_pos_snapshot.sql'))
  if(posMigration)await db.exec(await readFile(new URL('../supabase/migrations/'+posMigration,import.meta.url),'utf8'))
  const termsMigration=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(name=>name.endsWith('_agenda_accepted_terms.sql'))
  if(termsMigration)await db.exec(await readFile(new URL('../supabase/migrations/'+termsMigration,import.meta.url),'utf8'))
  await db.exec(`insert into agenda_professionals(id,organization_id,name) values ('${prof}','${org}','Ana');
    insert into agenda_settings(organization_id,online_booking,min_notice_minutes,opening_hours) values ('${org}',true,0,'{"0":[["08:00","18:00"]],"1":[["08:00","18:00"]],"2":[["08:00","18:00"]],"3":[["08:00","18:00"]],"4":[["08:00","18:00"]],"5":[["08:00","18:00"]],"6":[["08:00","18:00"]]}');
    insert into agenda_services(organization_id,product_id,duration_minutes) values ('${org}','${product}',30);`)
})
beforeEach(async () => {
  await db.exec(`truncate agenda_booking_quotes,appointments,appointment_events,sales,sale_items,sale_payments,cash_movements; delete from agenda_time_off; delete from agenda_professional_service_rates;
    update agenda_settings set professional_selection='optional'; update agenda_professionals set online_visible=true,opening_hours=null;
    update agenda_services set duration_minutes=30,buffer_minutes=0;
    update products set sale_price=30000,hide_price=false;
    insert into agenda_professional_service_rates values ('${org}','${prof}','${product}',40000,45,5);`)
})
after(async () => { await db.close() })
const quote = async () => (await db.query('select create_agenda_quote($1,$2,$3,$4) as quote', [org, product, prof, start])).rows[0].quote
const reserve = async (id, body = customer) => (await db.query('select reserve_agenda_quote($1,$2,$3) as reservation', [id, key, JSON.stringify(body)])).rows[0].reservation

test('reserves server terms, retries once and rejects a changed customer body', async () => {
  const q = await quote()
  assert.equal(Number(q.price), 40000)
  const first = await reserve(q.id)
  const retry = await reserve(q.id)
  assert.equal(first.id, retry.id)
  assert.equal((await db.query('select count(*)::int as n from appointments')).rows[0].n, 1)
  const saved = (await db.query('select price,buffer_minutes,extract(epoch from ends_at-starts_at)/60 as minutes from appointments')).rows[0]
  assert.equal(Number(saved.price), 40000); assert.equal(saved.buffer_minutes, 5); assert.equal(Number(saved.minutes), 45)
  await assert.rejects(reserve(q.id, { ...customer, name: 'Otra persona' }), /IDEMPOTENCY_CONFLICT/)
})
test('rejects changed configuration and expired quotes', async () => {
  const q = await quote()
  await db.exec('update agenda_professional_service_rates set price=50000')
  await assert.rejects(reserve(q.id), /QUOTE_CHANGED/)
  const next = await quote()
  await db.query("update agenda_booking_quotes set created_at=now()-interval '1 hour',expires_at=now()-interval '1 minute' where id=$1", [next.id])
  await assert.rejects(reserve(next.id), /QUOTE_EXPIRED/)
})
test('occupied buffer rejects another appointment and a conflicting absence', async () => {
  await reserve((await quote()).id)
  await assert.rejects(db.query('select create_agenda_quote($1,$2,$3,$4::timestamptz + interval \'45 minutes\')', [org, product, prof, start]), /APPOINTMENT_OVERLAP/)
  await assert.rejects(db.query('insert into agenda_time_off(organization_id,professional_id,starts_at,ends_at) values($1,$2,$3,$3::timestamptz+interval \'1 hour\')', [org,prof,start]), /TIME_OFF_CONFLICT/)
})
test('hidden professionals cannot be auto-assigned and required selection cannot be omitted', async () => {
  await db.exec('update agenda_professionals set online_visible=false')
  await assert.rejects(db.query('select create_agenda_quote($1,$2,null,$3)', [org,product,start]), /NO_ELIGIBLE_PROFESSIONAL/)
  await db.exec("update agenda_settings set professional_selection='required'")
  await assert.rejects(db.query('select create_agenda_quote($1,$2,null,$3)', [org,product,start]), /PROFESSIONAL_REQUIRED/)
})
test('public roles cannot execute privileged quote or booking writes', async () => {
  await db.exec('set role anon')
  try { await assert.rejects(quote(), /permission denied/) } finally { await db.exec('reset role') }
})

test('rescheduling keeps the agreed price, duration and buffer after tariffs change', async () => {
  const saved = await reserve((await quote()).id)
  await db.exec('update agenda_professional_service_rates set price=60000,duration_minutes=60,buffer_minutes=10')
  const moved = (await db.query('select reschedule_agenda_appointment($1,$2,$3::timestamptz + interval \'2 hours\',$4) as appointment', [org,saved.id,start,saved.public_token])).rows[0].appointment
  assert.equal(Number(moved.price), 40000)
  assert.equal(moved.buffer_minutes, 5)
  assert.equal((Date.parse(moved.ends_at)-Date.parse(moved.starts_at))/60000, 45)
})

test('an explicit zero tariff never falls back to the catalog price', async () => {
  await db.exec('update agenda_professional_service_rates set price=0,buffer_minutes=0')
  const q = await quote()
  assert.equal(Number(q.price), 0)
  assert.equal(q.buffer_minutes, 0)
  await reserve(q.id)
  assert.equal(Number((await db.query('select price from appointments')).rows[0].price),0)
})
test('public rescheduling cannot target a professional hidden after booking',async()=>{
  const saved=await reserve((await quote()).id)
  await db.exec('update agenda_professionals set online_visible=false')
  await assert.rejects(db.query('select reschedule_agenda_appointment($1,$2,$3::timestamptz + interval \'2 hours\',$4)',[org,saved.id,start,saved.public_token]),/APPOINTMENT_NOT_CHANGEABLE/)
})
test('authenticated users cannot invoke internal checkout clones or overwrite prices',async()=>{
  const a=await reserve((await quote()).id)
  await db.exec('set role authenticated')
  try{
    await assert.rejects(checkout(a.id),/permission denied/)
    await assert.rejects(db.query('update appointments set price=1 where id=$1',[a.id]),/permission denied/)
  }finally{await db.exec('reset role')}
})

test('replacing eligibility is atomic and cannot accept another organization product', async () => {
  await db.query('select replace_agenda_professional_services($1,$2,$3,$4)',[org,prof,JSON.stringify([product]),actor])
  await assert.rejects(db.query('select replace_agenda_professional_services($1,$2,$3,$4)',[org,prof,JSON.stringify([key]),actor]),/SERVICE_UNAVAILABLE/)
  assert.equal((await db.query('select product_id from agenda_professional_services')).rows[0].product_id,product)
  await db.query('select replace_agenda_professional_services($1,$2,$3,$4)',[org,prof,'[]',actor])
  assert.equal((await db.query('select count(*)::int as n from agenda_professional_services')).rows[0].n,0)
})

test('rate replacements preserve explicit zero and reject a foreign actor', async () => {
  const rows = [{product_id:product,price:0,duration_minutes:null,buffer_minutes:0}]
  await db.query('select replace_agenda_professional_rates($1,$2,$3,$4)',[org,prof,JSON.stringify(rows),actor])
  assert.equal(Number((await quote()).price),0)
  await assert.rejects(db.query('select replace_agenda_professional_rates($1,$2,$3,$4)',[org,prof,'[]',key]),/ACTOR_NOT_AUTHORIZED/)
  assert.equal((await db.query('select count(*)::int as n from agenda_professional_service_rates')).rows[0].n,1)
})

test('settings and service terms commit together and roll back on an invalid service',async()=>{
  const settings=(await db.query('select to_jsonb(s) as settings from agenda_settings s')).rows[0].settings
  await db.query('select save_agenda_settings($1,$2,$3,$4)',[org,JSON.stringify({...settings,professional_selection:'required'}),JSON.stringify([{product_id:product,duration_minutes:40,buffer_minutes:10,online:true}]),actor])
  await assert.rejects(db.query('select save_agenda_settings($1,$2,$3,$4)',[org,JSON.stringify({...settings,professional_selection:'disabled'}),JSON.stringify([{product_id:key,duration_minutes:60,buffer_minutes:0,online:true}]),actor]),/SERVICE_UNAVAILABLE/)
  assert.equal((await db.query('select professional_selection from agenda_settings')).rows[0].professional_selection,'required')
  assert.equal((await db.query('select duration_minutes from agenda_services')).rows[0].duration_minutes,40)
})

test('internal service creation ignores a forged client price and preserves a moved snapshot',async()=>{
  const body={customer_name:'Cliente',customer_phone:'0981000000',service_product_id:product,service_name:'Forged',professional_id:prof,price:1,duration_minutes:5,starts_at:start,status:'confirmed'}
  const saved=(await db.query('select save_agenda_appointment($1,null,$2,$3) as appointment',[org,JSON.stringify(body),actor])).rows[0].appointment
  assert.equal(Number(saved.price),40000); assert.equal((Date.parse(saved.ends_at)-Date.parse(saved.starts_at))/60000,45)
  await db.exec('update agenda_professional_service_rates set price=60000,duration_minutes=60')
  const moved=(await db.query('select save_agenda_appointment($1,$2,$3,$4) as appointment',[org,saved.id,JSON.stringify({...body,starts_at:new Date(Date.parse(start)+7200000).toISOString()}),actor])).rows[0].appointment
  assert.equal(Number(moved.price),40000)
  assert.equal((Date.parse(moved.ends_at)-Date.parse(moved.starts_at))/60000,45)
})

const checkout=async(id,amount=40000,attempt='sale-attempt',options={})=>(await db.query('select process_agenda_pos_sale($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',
  [org,branch,actor,session,id,attempt,JSON.stringify([{product_id:product,quantity:1,discount_amount:0}]),JSON.stringify(amount===0?[]:[{payment_method:'cash',amount}]),JSON.stringify({price_mode:'retail',tax_rate:0,prices_include_tax:true,...options})])).rows[0].result

test('changed internal terms reject stale acceptance and roll back the appointment',async()=>{
  const body={customer_name:'Cliente',service_product_id:product,service_name:'Corte',professional_id:prof,price:40000,duration_minutes:45,starts_at:start,status:'confirmed'}
  const saved=(await db.query('select save_agenda_appointment($1,null,$2,$3) as appointment',[org,JSON.stringify(body),actor])).rows[0].appointment
  const changed={...body,professional_id:null,accept_new_terms:true,accepted_terms:{price:20000,duration_minutes:30,buffer_minutes:0}}
  await assert.rejects(db.query('select save_agenda_appointment($1,$2,$3,$4)',[org,saved.id,JSON.stringify(changed),actor]),/ACCEPTED_TERMS_CHANGED/)
  const unchanged=(await db.query('select price,professional_id from appointments where id=$1',[saved.id])).rows[0]
  assert.equal(Number(unchanged.price),40000);assert.equal(unchanged.professional_id,prof)
  const updated=(await db.query('select save_agenda_appointment($1,$2,$3,$4) as appointment',[org,saved.id,JSON.stringify({...changed,accepted_terms:{price:30000,duration_minutes:30,buffer_minutes:0}}),actor])).rows[0].appointment
  assert.equal(Number(updated.price),30000);assert.equal(updated.professional_id,null)
})

test('changing internal terms requires the displayed snapshot and hides the base RPC',async()=>{
  const saved=await reserve((await quote()).id)
  const changed={customer_name:'Cliente',service_product_id:product,service_name:'Corte',professional_id:null,price:30000,duration_minutes:30,starts_at:start,accept_new_terms:true}
  await assert.rejects(db.query('select save_agenda_appointment($1,$2,$3,$4)',[org,saved.id,JSON.stringify(changed),actor]),/NEW_TERMS_ACCEPTANCE_REQUIRED/)
  const grants=(await db.query("select has_function_privilege('service_role','public.save_agenda_appointment_base_v1(uuid,uuid,jsonb,uuid)','execute') as base,has_function_privilege('service_role','public.save_agenda_appointment(uuid,uuid,jsonb,uuid)','execute') as wrapper")).rows[0]
  assert.equal(grants.base,false);assert.equal(grants.wrapper,true)
})
test('POS retry ignores generated receipt codes but rejects a changed payment',async()=>{
  const a=await reserve((await quote()).id)
  const result=await checkout(a.id,40000,'retry',{code:'POS-FIRST'})
  assert.equal((await checkout(a.id,40000,'retry',{code:'POS-RETRY'})).sale_id,result.sale_id)
  await assert.rejects(checkout(a.id,30000,'retry'),/IDEMPOTENCY_CONFLICT/)
})
test('POS persists a higher snapshot price, cash payment and atomic appointment link without changing catalog stock',async()=>{
  const a=await reserve((await quote()).id)
  const result=await checkout(a.id)
  assert.equal(Number(result.total),40000)
  assert.equal(Number((await db.query('select unit_price from sale_items')).rows[0].unit_price),40000)
  assert.equal(Number((await db.query('select amount from sale_payments')).rows[0].amount),40000)
  assert.equal(Number((await db.query('select amount from cash_movements')).rows[0].amount),40000)
  assert.equal((await db.query('select sale_id,status from appointments')).rows[0].sale_id,result.sale_id)
  assert.equal((await db.query('select status from appointments')).rows[0].status,'completed')
  assert.equal(Number((await db.query('select stock_quantity from products')).rows[0].stock_quantity),0)
  assert.equal(Number((await db.query('select sale_price from products')).rows[0].sale_price),30000)
  assert.equal((await checkout(a.id)).sale_id,result.sale_id)
  await assert.rejects(checkout(a.id,40000,'different-attempt'),/APPOINTMENT_ALREADY_PAID/)
})
test('POS keeps the appointment price after the catalog changes and rejects mismatched payment atomically',async()=>{
  const a=await reserve((await quote()).id)
  await db.exec('update products set sale_price=50000')
  try {
    await assert.rejects(checkout(a.id,50000),/PAYMENT_TOTAL_MISMATCH/)
    assert.equal((await db.query('select count(*)::int as n from sales')).rows[0].n,0)
    assert.equal((await db.query('select sale_id from appointments')).rows[0].sale_id,null)
    assert.equal(Number((await checkout(a.id)).total),40000)
  }finally{await db.exec('update products set sale_price=30000')}
})
test('POS records a zero-price appointment without inventing payments or cash movements',async()=>{
  await db.exec('update agenda_professional_service_rates set price=0')
  const a=await reserve((await quote()).id)
  assert.equal(Number((await checkout(a.id,0)).total),0)
  assert.equal(Number((await db.query('select unit_price from sale_items')).rows[0].unit_price),0)
  assert.equal((await db.query('select count(*)::int as n from cash_movements')).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int as n from sale_payments')).rows[0].n,0)
})
