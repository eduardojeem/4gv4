// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, expect, it } from 'vitest'
const db = new PGlite()
const org = '10000000-0000-0000-0000-000000000001'
const owner = '20000000-0000-0000-0000-000000000001'
const staff = '20000000-0000-0000-0000-000000000002'
async function actor(role: string, user = staff) {
  await db.query("select set_config('request.jwt.claims',$1,false), set_config('request.jwt.claim.sub',$2,false)", [JSON.stringify({ role }), user])
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.jwt() returns jsonb language sql as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.sales(id serial primary key, organization_id uuid, payment_method text);
    create table public.organization_settings(organization_id uuid primary key, modules jsonb, updated_at timestamptz);
    create table public.system_settings(id text primary key, features jsonb, updated_at timestamptz, updated_by uuid);
    create table public.profiles(id uuid primary key, status text);
    create table public.user_roles(user_id uuid primary key, role text, is_active boolean);
    create table public.organization_members(organization_id uuid,user_id uuid,status text,role text);
    insert into organization_settings values('${org}','{"repairs":true,"payment_controls":{"cash":false,"card":true,"transfer":false,"qr":true}}',null);
    insert into profiles values('${owner}','active'),('${staff}','active');
    insert into user_roles values('${owner}','super_admin',true);
    insert into system_settings values('system','{"branding":"old"}',null,null);
    insert into organization_members values('${org}','${owner}','active','owner'),('${org}','${staff}','active','vendedor');`)
  await db.exec(readFileSync('supabase/migrations/20261103232929_commerce_payment_control_guards.sql', 'utf8'))
}, 30000)
afterAll(() => db.close())
it('blocks disabled direct sales and unknown/mixed requests while allowing enabled card', async () => {
  await actor('authenticated')
  await expect(db.query('insert into sales(organization_id,payment_method) values($1,$2)', [org, 'efectivo'])).rejects.toThrow('PAYMENT_METHOD_DISABLED')
  await expect(db.query('insert into sales(organization_id,payment_method) values($1,$2)', [org, 'mixed'])).rejects.toThrow('PAYMENT_METHOD_REQUIRES_SERVER')
  await expect(db.query('insert into sales(organization_id,payment_method) values($1,$2)', [org, 'qr'])).rejects.toThrow('PAYMENT_METHOD_DISABLED')
  await db.query('insert into sales(organization_id,payment_method) values($1,$2)', [org, 'card'])
})
it('preserves guarded service-role mixed writes and historical updates', async () => {
  await actor('service_role')
  await db.query('insert into sales(organization_id,payment_method) values($1,$2)', [org, 'mixed'])
  await actor('authenticated')
  await db.exec("update sales set payment_method='cash' where payment_method='card'")
  expect((await db.query<{ count: number }>('select count(*)::integer count from sales')).rows[0].count).toBe(2)
})
it('does not allow staff to remove restrictions, but preserves unrelated module updates', async () => {
  await actor('authenticated')
  await expect(db.query("update organization_settings set modules='{}' where organization_id=$1", [org])).rejects.toThrow('PAYMENT_CONTROLS_FORBIDDEN')
  await db.query("update organization_settings set modules=jsonb_set(modules,'{repairs}','false') where organization_id=$1", [org])
  await actor('authenticated', owner)
  await db.query("update organization_settings set modules=jsonb_set(modules,'{payment_controls,cash}','true') where organization_id=$1", [org])
  expect((await db.query<{ version: number }>('select commerce_payment_controls_version() version')).rows[0].version).toBe(2)
})
it('atomically changes one authorized flag and prevents stale company saves from re-enabling it', async () => {
  await actor('service_role')
  const before = (await db.query<{ modules: Record<string, unknown>; updated_at: string }>('select modules, updated_at from organization_settings where organization_id=$1', [org])).rows[0]
  await db.query('select update_payment_control_policy($1,$2,$3,$4,$5,$6)', ['commerce', org, 'card', false, before.updated_at, owner])
  await expect(db.query('select update_payment_control_policy($1,$2,$3,$4,$5,$6)', ['commerce', org, 'card', true, before.updated_at, owner])).rejects.toThrow('PAYMENT_CONTROLS_CONFLICT')
  // A legacy upsert based on the pre-toggle snapshot still updates its own field.
  await db.query('update organization_settings set modules=$1, updated_at=$2 where organization_id=$3', [JSON.stringify({ ...before.modules, repairs: true }), before.updated_at, org])
  const after = (await db.query<{ modules: { repairs: boolean; payment_controls: { card: boolean } } }>('select modules from organization_settings where organization_id=$1', [org])).rows[0]
  expect(after.modules.repairs).toBe(true)
  expect(after.modules.payment_controls.card).toBe(false)
})
it('preserves platform policy during branding updates and rejects wrong actors', async () => {
  await actor('service_role')
  await db.query('select update_payment_control_policy($1,$2,$3,$4,$5,$6)', ['subscriptions', null, 'stripe', false, null, owner])
  await db.exec("update system_settings set features='{\"branding\":\"new\"}', updated_at=null where id='system'")
  const row = (await db.query<{ features: { branding: string; payment_controls: { stripe: boolean } }; updated_at: string }>("select features,updated_at from system_settings where id='system'")).rows[0]
  expect(row.features).toMatchObject({ branding: 'new', payment_controls: { stripe: false } })
  await expect(db.query('select update_payment_control_policy($1,$2,$3,$4,$5,$6)', ['subscriptions', null, 'stripe', true, row.updated_at, staff])).rejects.toThrow('PAYMENT_CONTROLS_FORBIDDEN')
})
