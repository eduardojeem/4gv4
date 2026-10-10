// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const org = '00000000-0000-0000-0000-000000000001'
const actor = '00000000-0000-0000-0000-000000000002'
const key = '00000000-0000-0000-0000-000000000003'
const nextKey = '00000000-0000-0000-0000-000000000004'
const input = { name: 'Manicura', price: 75000, durationMinutes: 55, catalogVisible: true, online: false }
let db: PGlite
beforeEach(async () => {
  db = new PGlite()
  await db.exec(`create role service_role bypassrls; create role anon; create role authenticated;
    create table organizations(id uuid primary key, plan text);
    create table organization_members(organization_id uuid,user_id uuid,status text,role text);
    create table plans(id int); create table subscription_plans(id int);
    create table subscriptions(organization_id uuid);
    create table organization_module_trials(organization_id uuid);
    create table products(id uuid primary key default gen_random_uuid(),organization_id uuid,sku varchar(100) unique,name varchar(200),sale_price numeric(10,2),purchase_price numeric,unit_measure text,stock_quantity integer,min_stock integer,is_active boolean,visibility text,archived_by_plan_at timestamptz);
    create table agenda_services(organization_id uuid,product_id uuid,duration_minutes integer check(duration_minutes>=5),online boolean,buffer_minutes integer,primary key(organization_id,product_id));
    create table agenda_settings(organization_id uuid,slot_minutes integer);
    create table tenant_audit_log(organization_id uuid,user_id uuid,action text,resource text,resource_id text,metadata jsonb);
    insert into organizations values('${org}','PRO');
    insert into organization_members values('${org}','${actor}','active','owner');
    insert into agenda_settings values('${org}',20);`)
  // Actual existing authorization helper, not a test stub that always allows.
  const existing = readFileSync('supabase/migrations/20261014120002_agenda_booking_atomic.sql', 'utf8')
  const start = existing.indexOf('create function public.agenda_assert_actor')
  await db.exec(existing.slice(start, existing.indexOf('create function public.replace_agenda_professional_services', start)))
  await db.exec(existing.slice(existing.indexOf('create function public.agenda_lock'), existing.indexOf('create function public.agenda_booking_version')))
  await db.exec(readFileSync('supabase/migrations/20261014120007_agenda_service_creation_atomic.sql', 'utf8'))
}, 30000)
afterEach(async () => { await db?.close() })
const revision = async () => (await db.query<{ revision: string }>('select public.agenda_service_policy_revision($1) as revision', [org])).rows[0].revision
const create = async (requestKey = key, payload = input, limit: number | null = 1, policy?: string) =>
  (await db.query<{ result: { id: string; replayed: boolean } }>('select public.create_agenda_service($1,$2,$3,$4::jsonb,$5,$6) as result', [org, actor, requestKey, JSON.stringify(payload), limit, policy ?? await revision()])).rows[0].result

describe('atomic agenda service creation SQL', () => {
  it('creates both rows, preserves schedule and replays the last quota slot without duplicates', async () => {
    const first = await create()
    expect(first.replayed).toBe(false)
    expect(await create()).toEqual({ id: first.id, replayed: true })
    expect((await db.query('select name,sale_price,unit_measure,stock_quantity,visibility from products')).rows).toEqual([{ name: 'Manicura', sale_price: '75000.00', unit_measure: 'servicio', stock_quantity: 0, visibility: 'public' }])
    expect((await db.query('select duration_minutes,online from agenda_services')).rows).toEqual([{ duration_minutes: 55, online: false }])
    expect((await db.query('select slot_minutes from agenda_settings')).rows).toEqual([{ slot_minutes: 20 }])
    await expect(create(nextKey)).rejects.toThrow('SERVICE_LIMIT_REACHED')
    await expect(create(key, { ...input, price: 1 })).rejects.toThrow('IDEMPOTENCY_CONFLICT')
    expect((await db.query('select count(*)::int as total from tenant_audit_log')).rows[0]).toEqual({ total: 1 })
  })
  it('rolls back product, service and replay record on audit failure', async () => {
    await db.exec('alter table tenant_audit_log add constraint reject_new check(false) not valid')
    await expect(create()).rejects.toThrow()
    for (const table of ['products', 'agenda_services', 'agenda_service_create_requests']) expect((await db.query(`select count(*)::int as total from ${table}`)).rows[0]).toEqual({ total: 0 })
  })
  it('rejects changed policy, invalid actors and unsafe payloads before creating anything', async () => {
    const old = await revision()
    await db.exec("update organizations set plan='FREE'")
    await expect(create(key, input, 1, old)).rejects.toThrow('SERVICE_POLICY_CHANGED')
    await expect(create(key, { ...input, durationMinutes: 1 })).rejects.toThrow('INVALID_SERVICE')
    await db.exec("update organization_members set status='inactive'")
    await expect(create()).rejects.toThrow('ACTOR_NOT_AUTHORIZED')
    expect((await db.query('select count(*)::int as total from products')).rows[0]).toEqual({ total: 0 })
  })
  it('keeps idempotency and RPC inaccessible to anon/authenticated and supports the real server role', async () => {
    for (const role of ['anon', 'authenticated']) {
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege('${role}','public.create_agenda_service(uuid,uuid,uuid,jsonb,integer,text)','execute') as allowed`)).rows[0].allowed).toBe(false)
      expect((await db.query<{ allowed: boolean }>(`select has_table_privilege('${role}','public.agenda_service_create_requests','select') as allowed`)).rows[0].allowed).toBe(false)
    }
    await db.exec('grant all on all tables in schema public to service_role; set role service_role;')
    expect((await create()).id).toBeTruthy()
  })
})
