import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const db = new PGlite()
const actor = '55555555-5555-4555-8555-555555555555'
before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role;')
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const original = await readFile(new URL('20260927120251_server_only_cash_rpcs.sql', dir), 'utf8')
  await db.exec(original.slice(0, original.indexOf('create or replace function public.server_open_cash_register_atomic')))
  const migration = (await readdir(dir)).find(name => name.endsWith('_cash_actor_jwt_claims_compatibility.sql'))
  assert.ok(migration, 'compatibility migration exists')
  await db.exec(await readFile(new URL(migration, dir), 'utf8'))
})
after(async () => db.close())

async function request(legacyRole, claims, callback, role = 'service_role') {
  assert.ok(['service_role', 'authenticated', 'anon'].includes(role))
  await db.exec(`begin; set local role ${role};`)
  try {
    await db.query("select set_config('request.jwt.claim.role',$1,true), set_config('request.jwt.claims',$2,true)", [legacyRole, claims])
    await callback()
  } finally {
    await db.exec('rollback')
  }
}
const guard = (id = actor) => db.query('select public.assert_service_cash_actor($1::uuid)', [id])

test('accepts modern JSON service claims and preserves the real operator', async () => {
  await request('', '{"role":"service_role"}', async () => {
    await guard()
    const result = await db.query("select current_setting('request.jwt.claim.sub') as actor")
    assert.equal(result.rows[0].actor, actor)
  })
})
test('keeps legacy service claims compatible when JSON claims are empty', async () => {
  await request('service_role', '', async () => { await guard() })
})
test('does not accept a legacy service role over modern authenticated claims', async () => {
  await request('service_role', '{"role":"authenticated"}', async () => {
    await assert.rejects(guard(), /SERVICE_ROLE_REQUIRED/)
  })
})
test('rejects missing service claims', async () => {
  await request('', '', async () => { await assert.rejects(guard(), /SERVICE_ROLE_REQUIRED/) })
})
test('still requires an operator with modern service claims', async () => {
  await request('', '{"role":"service_role"}', async () => { await assert.rejects(guard(null), /ACTOR_REQUIRED/) })
})
test('public roles cannot invoke the guard even with forged service claims', async () => {
  for (const role of ['anon', 'authenticated']) {
    await request('', '{"role":"service_role"}', async () => {
      await assert.rejects(guard(), /permission denied/)
    }, role)
  }
})
