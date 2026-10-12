// LOCAL ONLY: reserved fictitious IDs. Does not read connection secrets.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const org = 'ca110000-0000-4000-8000-000000000001'
const customer = 'ca210000-0000-4000-8000-000000000001'
const actor = 'ca010000-0000-4000-8000-000000000001'
const branch = 'ca310000-0000-4000-8000-000000000001'
const args = ['exec', '-i', 'supabase_db_4gv4', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
function sql(query) {
  const result = spawnSync('docker', args, { input: query, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Local psql failed')
  return result.stdout.trim()
}
function asyncSql(query, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args)
    let out = '', err = ''
    child.stdout.on('data', chunk => { out += chunk; onLine?.(out) })
    child.stderr.on('data', chunk => { err += chunk })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve(out) : reject(new Error(err)))
    child.stdin.end(query)
  })
}
function invoke(key) {
  const payload = JSON.stringify({ amount: 100, paymentMethod: 'cash', mode: 'manual',
    idempotencyKey: key, allocations: [{ id: 'ca710000-0000-4000-8000-000000000001', type: 'installment', amount: 100 }] })
  return "select public.collect_customer_payment_atomic('" + org + "','" + customer + "','" + actor + "','" + branch + "','" + payload + "');"
}
const fixture = readFileSync('supabase/tests/customer_collection_atomic.test.sql', 'utf8').split('set local role service_role;')[0]
assert.equal(sql("select count(*) from public.organizations where id='" + org + "';"), '0', 'Reserved fixture exists: refusing overwrite')
try {
  sql(fixture + '\ncommit;')
  let signal
  const ready = new Promise(resolve => { signal = resolve })
  const first = asyncSql('begin; set local role service_role; ' + invoke('concurrent-identical') +
    '\n\\echo LOCK_HELD\nselect pg_sleep(1); commit;', out => { if (out.includes('LOCK_HELD')) signal() })
  await Promise.race([ready, first.then(() => { throw new Error('Lock signal missing') })])
  const second = asyncSql('begin; set local role service_role; ' + invoke('concurrent-identical') + ' commit;')
  const [one, two] = await Promise.all([first, second])
  const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')))
  assert.deepEqual(receipt(one), receipt(two), 'Concurrent retries return identical receipt')
  assert.equal(sql("select count(*) from public.credit_payments where credit_id='ca610000-0000-4000-8000-000000000001';"), '1')
  await assert.rejects(asyncSql('begin; set local role service_role; ' + invoke('concurrent-new-stale') + ' commit;'), /COLLECTION_BALANCE_CHANGED/)
  console.log('PASS: concurrent retry has one payment and receipt; stale allocation rejected')
} finally {
  sql("begin; " +
    "delete from public.customer_collection_requests where organization_id='" + org + "';" +
    "delete from public.cash_movements where organization_id='" + org + "';" +
    "delete from public.credit_payments where credit_id='ca610000-0000-4000-8000-000000000001';" +
    "delete from public.credit_installments where credit_id='ca610000-0000-4000-8000-000000000001';" +
    "delete from public.customer_credits where organization_id='" + org + "';" +
    "delete from public.cash_closures where organization_id='" + org + "';" +
    "delete from public.customers where organization_id='" + org + "';" +
    "delete from public.branches where organization_id='" + org + "';" +
    "delete from public.organization_members where organization_id='" + org + "';" +
    "delete from public.organizations where id='" + org + "';" +
    "delete from public.profiles where id in ('" + actor + "','ca010000-0000-4000-8000-000000000002');" +
    "delete from auth.users where id in ('" + actor + "','ca010000-0000-4000-8000-000000000002'); commit;")
}
