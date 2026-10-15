import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
const db = new PGlite()
after(() => db.close())
const org = '00000000-0000-0000-0000-000000000001'
const actor = '00000000-0000-0000-0000-000000000002'
await db.exec(`create role service_role; create role authenticated; create role anon;
create schema auth;
create table public.profiles(id uuid primary key, status text);
create table public.organization_members(organization_id uuid, user_id uuid, role text, status text);
create table public.organization_settings(organization_id uuid primary key, modules jsonb);
insert into public.profiles values('${actor}','active');
insert into public.organization_members values('${org}','${actor}','owner','active');
insert into public.organization_settings values('${org}','{"finances":{"enabled":true},"onboarding":{"status":"completed"}}');
grant select on public.profiles, public.organization_members to service_role;
grant select,update on public.organization_settings to service_role;`)
await db.exec(await readFile(new URL('../supabase/migrations/20261013233736_business_start_guide_preferences.sql', import.meta.url), 'utf8'))
const save = (preferences, user = actor) => db.query('select public.server_save_business_start_guide_preferences($1::uuid,$2::uuid,$3::jsonb)', [org, user, JSON.stringify(preferences)])
test('preferences preserve unrelated modules and can be reopened', async () => {
  await save({ version: 1, teamMode: 'team', postponed: true })
  await save({ version: 1, teamMode: 'solo', postponed: false })
  const { rows } = await db.query('select modules from public.organization_settings')
  assert.deepEqual(rows[0].modules.finances, { enabled: true })
  assert.deepEqual(rows[0].modules.onboarding, { status: 'completed' })
  assert.deepEqual(rows[0].modules.business_start_guide, { version: 1, teamMode: 'solo', postponed: false })
})
test('actor from another organization cannot save', async () => {
  await assert.rejects(save({ version: 1, teamMode: null, postponed: false }, org), /FORBIDDEN/)
})
test('calculated completion and invalid preferences are rejected', async () => {
  await assert.rejects(save({ version: 1, teamMode: null, postponed: false, completed: true }), /INVALID/)
  await assert.rejects(save({ version: 1, teamMode: 'invalid', postponed: false }), /INVALID/)
})
test('public clients cannot invoke preference RPC', async () => {
  const { rows } = await db.query(`select has_function_privilege('anon','public.server_save_business_start_guide_preferences(uuid,uuid,jsonb)','EXECUTE') as anon, has_function_privilege('authenticated','public.server_save_business_start_guide_preferences(uuid,uuid,jsonb)','EXECUTE') as authenticated`)
  assert.equal(rows[0].anon, false)
  assert.equal(rows[0].authenticated, false)
})
