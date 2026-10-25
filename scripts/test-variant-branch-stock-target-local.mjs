import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const docker = process.env.DOCKER_CLI || 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'
const container = process.env.VARIANT_RACE_CONTAINER || 'mitiendapy-variant-race-db'
const database = 'mitiendapy_variant_race_test'
const org = '00000000-0000-4000-8000-000000000001'
const branch = '00000000-0000-4000-8000-000000000002'
const product = '00000000-0000-4000-8000-000000000003'
const variant = '00000000-0000-4000-8000-000000000004'
const actor = '00000000-0000-4000-8000-000000000005'
const branchOther = '00000000-0000-4000-8000-000000000007'
const orgOther = '00000000-0000-4000-8000-000000000008'
const branchOtherOrg = '00000000-0000-4000-8000-000000000009'

function quote(value) {
  if (!/^[A-Za-z0-9._:-]{1,255}$/.test(value)) throw new Error('Invalid local test literal')
  return "'" + value + "'"
}

async function psql(sql) {
  const { stdout } = await execFileAsync(docker, [
    'exec', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', database, '-c', sql,
  ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 })
  return stdout.trim()
}

function call(target, key, { organizationId = org, branchId = branch, variantId = variant } = {}) {
  return `select public.set_variant_branch_stock_target(${quote(organizationId)}, ${quote(branchId)}, ${quote(variantId)}, ${target}, ${quote('variant-target:' + key)}, ${quote(actor)}, 'variant_target_test', ${quote(product)}, 'Synthetic local stock test', '{}'::jsonb)::text`
}

async function resetMain({ stock = 3, missing = false } = {}) {
  await psql(`delete from private.variant_branch_stock_target_requests where organization_id=${quote(org)} and variant_id=${quote(variant)}; delete from public.variant_inventory_movements where organization_id=${quote(org)} and variant_id=${quote(variant)};`)
  if (missing) {
    await psql(`delete from public.branch_variant_inventory where organization_id=${quote(org)} and branch_id=${quote(branch)} and variant_id=${quote(variant)};`)
  } else {
    await psql(`insert into public.branch_variant_inventory(organization_id,branch_id,product_id,variant_id,stock_quantity,min_stock,reserved_quantity) values(${quote(org)},${quote(branch)},${quote(product)},${quote(variant)},${stock},0,0) on conflict do nothing; update public.branch_variant_inventory set product_id=${quote(product)},stock_quantity=${stock},min_stock=0,reserved_quantity=least(reserved_quantity,${stock}) where organization_id=${quote(org)} and branch_id=${quote(branch)} and variant_id=${quote(variant)};`)
  }
}
async function currentStock(branchId = branch) {
  return Number(await psql(`select coalesce((select stock_quantity from public.branch_variant_inventory where organization_id=${quote(org)} and branch_id=${quote(branchId)} and variant_id=${quote(variant)}),-1)`))
}

async function runRace({ missing = false, iterations = 12 } = {}) {
  let observed = []
  for (let i = 0; i < iterations; i += 1) {
    await resetMain({ stock: 3, missing })
    const prefix = `race-${missing ? 'missing' : 'existing'}-${i}`
    const qA = `select pg_sleep(0.05); ${call(10, prefix + '-a')}`
    const qB = `select pg_sleep(0.05); ${call(12, prefix + '-b')}`
    const [aText, bText] = await Promise.all([psql(qA), psql(qB)])
    const after = await currentStock()
    assert.ok(after === 10 || after === 12, `expected absolute final target, got ${after}`)
    const ledger = JSON.parse(await psql(`select json_build_object('count',count(*),'sum',coalesce(sum(quantity_delta),0)) from public.variant_inventory_movements where organization_id=${quote(org)} and branch_id=${quote(branch)} and variant_id=${quote(variant)}`))
    assert.equal(ledger.count, 2, 'both different requests must create one adjustment each')
    assert.equal((missing ? 0 : 3) + Number(ledger.sum), after, 'movement ledger must reconcile from the baseline')
    const replies = [JSON.parse(aText.split('\n').at(-1)), JSON.parse(bText.split('\n').at(-1))]
    assert.deepEqual(replies.map(x => Number(x.stock_after)).sort((x,y)=>x-y), [10,12])
    observed.push(after)
  }
  return observed
}

const databaseTarget = await psql('select current_database()')
assert.equal(databaseTarget, database, 'refuse to run outside the disposable database')
const functionExists = await psql("select to_regprocedure('public.set_variant_branch_stock_target(uuid,uuid,uuid,integer,text,uuid,text,uuid,text,jsonb)') is not null")
assert.equal(functionExists, 't', 'apply the target migration before this integration test')

// Positive increase, retry, no-op request, decrease, and movement reconciliation.
await resetMain({ stock: 3 })
const basic = await psql(`do $test$ declare r jsonb; retry jsonb; noop jsonb; down jsonb; n integer; total integer; current integer; begin
  r := public.set_variant_branch_stock_target(${quote(org)},${quote(branch)},${quote(variant)},10,'variant-target:basic-up',${quote(actor)},'variant_target_test',${quote(product)},'test','{}');
  if (r->>'stock_before')::int <> 3 or (r->>'stock_after')::int <> 10 or (r->>'applied_delta')::int <> 7 then raise exception 'increase result mismatch: %',r; end if;
  retry := public.set_variant_branch_stock_target(${quote(org)},${quote(branch)},${quote(variant)},10,'variant-target:basic-up',${quote(actor)},'variant_target_test',${quote(product)},'test','{}');
  if retry->>'idempotent' <> 'true' then raise exception 'retry not idempotent: %',retry; end if;
  noop := public.set_variant_branch_stock_target(${quote(org)},${quote(branch)},${quote(variant)},10,'variant-target:basic-noop',${quote(actor)},'variant_target_test',${quote(product)},'test','{}');
  if (noop->>'applied_delta')::int <> 0 or noop->>'movement_id' <> 'null' then raise exception 'no-op created a movement: %',noop; end if;
  down := public.set_variant_branch_stock_target(${quote(org)},${quote(branch)},${quote(variant)},8,'variant-target:basic-down',${quote(actor)},'variant_target_test',${quote(product)},'test','{}');
  if (down->>'applied_delta')::int <> -2 then raise exception 'decrease result mismatch: %',down; end if;
  select stock_quantity into current from public.branch_variant_inventory where organization_id=${quote(org)} and branch_id=${quote(branch)} and variant_id=${quote(variant)};
  select count(*),sum(quantity_delta) into n,total from public.variant_inventory_movements where organization_id=${quote(org)} and branch_id=${quote(branch)} and variant_id=${quote(variant)};
  if current <> 8 or n <> 2 or 3 + total <> current then raise exception 'movement reconciliation mismatch: stock %, count %, sum %',current,n,total; end if;
end $test$; select 'basic-pass';`)
assert.equal(basic.split('\n').at(-1), 'basic-pass')

// Same idempotency key racing on one target applies one movement only.
await resetMain({ stock: 3 })
const sameKey = await Promise.all([psql(`select pg_sleep(0.05); ${call(10, 'same-key-race')}`), psql(`select pg_sleep(0.05); ${call(10, 'same-key-race')}`)])
assert.equal(await currentStock(), 10)
const sameMovementCount = Number(await psql(`select count(*) from public.variant_inventory_movements where organization_id=${quote(org)} and branch_id=${quote(branch)} and variant_id=${quote(variant)}`))
assert.equal(sameMovementCount, 1)
assert.equal(sameKey.length, 2)
let conflictError = ''
try { await psql(call(9, 'same-key-race')) } catch (error) { conflictError = String(error.stderr || error.message) }
assert.ok(conflictError.includes('VARIANT_STOCK_IDEMPOTENCY_CONFLICT'))

// First writes on an absent branch row are serialized and still use absolute targets.
const missingResults = await runRace({ missing: true, iterations: 12 })
const existingResults = await runRace({ missing: false, iterations: 12 })

// Branch isolation: writing a second branch creates its own row and leaves the first untouched.
await psql(`insert into public.branches(id,organization_id) values(${quote(branchOther)},${quote(org)}) on conflict(id) do nothing; delete from private.variant_branch_stock_target_requests where organization_id=${quote(org)} and branch_id=${quote(branchOther)} and variant_id=${quote(variant)}; delete from public.variant_inventory_movements where organization_id=${quote(org)} and branch_id=${quote(branchOther)} and variant_id=${quote(variant)}; delete from public.branch_variant_inventory where organization_id=${quote(org)} and branch_id=${quote(branchOther)} and variant_id=${quote(variant)};`)
await resetMain({ stock: 3 })
const branchCall = JSON.parse(await psql(call(4, 'branch-isolation', { branchId: branchOther })))
assert.equal(branchCall.stock_before, 0)
assert.equal(await currentStock(), 3)
assert.equal(await currentStock(branchOther), 4)

// Organization and branch mismatches fail closed without changing the base branch.
await psql(`insert into public.organizations(id) values(${quote(orgOther)}) on conflict(id) do nothing; insert into public.branches(id,organization_id) values(${quote(branchOtherOrg)},${quote(orgOther)}) on conflict(id) do nothing; insert into public.organization_members(organization_id,user_id,status) values(${quote(orgOther)},${quote(actor)},'active') on conflict do nothing;`)
for (const [organizationId, branchId, expected] of [[orgOther, branchOtherOrg, 'VARIANT_PRODUCT_NOT_IN_ORGANIZATION'], [org, branchOtherOrg, 'VARIANT_BRANCH_FORBIDDEN']]) {
  let errorText = ''
  try { await psql(call(6, 'scope-' + expected, { organizationId, branchId })) } catch (error) { errorText = String(error.stderr || error.message) }
  assert.ok(errorText.includes(expected), `expected ${expected}`)
}
assert.equal(await currentStock(), 3)

// Negative targets and mismatched idempotency parameters are rejected.
let negativeError = ''
try { await psql(call(-1, 'negative')) } catch (error) { negativeError = String(error.stderr || error.message) }
assert.ok(negativeError.includes('VARIANT_STOCK_INVALID_INPUT'))

// ACL and private request-ledger checks.
const acl = (await psql("select has_function_privilege('service_role','public.set_variant_branch_stock_target(uuid,uuid,uuid,integer,text,uuid,text,uuid,text,jsonb)','EXECUTE') || ':' || has_function_privilege('anon','public.set_variant_branch_stock_target(uuid,uuid,uuid,integer,text,uuid,text,uuid,text,jsonb)','EXECUTE') || ':' || has_function_privilege('authenticated','public.set_variant_branch_stock_target(uuid,uuid,uuid,integer,text,uuid,text,uuid,text,jsonb)','EXECUTE') || ':' || (select relrowsecurity from pg_class where oid='private.variant_branch_stock_target_requests'::regclass)"))
assert.equal(acl, 'true:false:false:true')

// Remove branch/org fixtures created only for this local test and restore the base stock.
await psql(`delete from private.variant_branch_stock_target_requests where branch_id in (${quote(branchOther)},${quote(branchOtherOrg)}); delete from public.variant_inventory_movements where branch_id in (${quote(branchOther)},${quote(branchOtherOrg)}); delete from public.branch_variant_inventory where branch_id in (${quote(branchOther)},${quote(branchOtherOrg)}); delete from public.organization_members where organization_id=${quote(orgOther)}; delete from public.branches where id in (${quote(branchOther)},${quote(branchOtherOrg)}); delete from public.organizations where id=${quote(orgOther)};`)
await resetMain({ stock: 3 })

console.log(JSON.stringify({
  target: `${databaseTarget} (disposable local PostgreSQL)`,
  sequential: 'PASS (increase, decrease, no-op, retry, ledger reconciliation)',
  sameKeyConcurrentRetry: 'PASS (one movement)',
  existingRowConcurrentIterations: existingResults.length,
  missingRowConcurrentIterations: missingResults.length,
  concurrentFinalTargets: [...existingResults, ...missingResults].every(v => v === 10 || v === 12),
  branchIsolation: 'PASS',
  organizationIsolation: 'PASS',
  negativeTarget: 'PASS',
  idempotencyConflict: 'PASS',
  acl: 'PASS (service_role only; private request ledger RLS enabled)',
}, null, 2))