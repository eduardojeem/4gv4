// Local-only integration runner. Never accepts a connection string or remote host.
// Use a disposable schema-only database. Tenant fixtures retain immutable audit
// history until that database is discarded; never bypass audit triggers to erase it.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const database = process.env.PRODUCT_SKU_TEST_DATABASE;
const container = process.env.PRODUCT_SKU_TEST_CONTAINER;
if (!/^sku_validation_[a-z0-9_]+$/.test(database ?? '') || !/^supabase_db_[a-z0-9_-]+$/.test(container ?? '')) {
  throw new Error('Set a dedicated local sku_validation_* database and supabase_db_* Docker container.');
}
const actor = randomUUID(), orgA = randomUUID(), orgB = randomUUID();
const branchA = randomUUID(), branchB = randomUUID();
const prefix = `RACE-${randomUUID().replaceAll('-', '')}`;
const args = ['--context', 'desktop-linux', 'exec', '-i', container, 'psql', '-X', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At'];
function sql(input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
async function ok(input) {
  const result = await sql(input);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}
const invoke = (org, branch, sku) => `select public.create_simple_product_atomic(jsonb_build_object(
  'organization_id','${org}','name','Synthetic SKU race','sku','${sku}',
  'sale_price',100,'stock_quantity',1,'initial_batch',jsonb_build_object('expires_on','2030-12-31')),
  '${branch}','${actor}');`;
const owned = `'${orgA}','${orgB}'`;
let sameOrg = 0, crossOrg = 0;
try {
  await ok(`begin;
    insert into auth.users(id,email,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
      values('${actor}','${actor}@example.invalid',now(),now(),'{}','{}');
    insert into public.organizations(id,name,slug,owner_id) values
      ('${orgA}','Synthetic SKU race A','race-${orgA}','${actor}'),
      ('${orgB}','Synthetic SKU race B','race-${orgB}','${actor}');
    insert into public.organization_members(organization_id,user_id,role,status) values
      ('${orgA}','${actor}','owner','active'),('${orgB}','${actor}','owner','active');
    insert into public.branches(id,organization_id,code,name,slug,is_default) values
      ('${branchA}','${orgA}','${branchA}','Synthetic A','${branchA}',true),
      ('${branchB}','${orgB}','${branchB}','Synthetic B','${branchB}',true);
    commit;`);
  for (let i = 0; i < 12; i++) {
    const sku = `${prefix}-S${i}`;
    const results = await Promise.all([
      sql(`begin; ${invoke(orgA, branchA, sku)} select pg_sleep(0.12); commit;`),
      sql(`begin; ${invoke(orgA, branchA, ` ${sku.toLowerCase()} `)} select pg_sleep(0.12); commit;`),
    ]);
    assert.equal(results.filter(r => r.code === 0).length, 1);
    assert.equal(results.filter(r => r.code !== 0 && /23505/.test(r.stderr)).length, 1);
    sameOrg++;
  }
  for (let i = 0; i < 12; i++) {
    const sku = `${prefix}-C${i}`;
    const results = await Promise.all([
      sql(`begin; ${invoke(orgA, branchA, sku)} select pg_sleep(0.12); commit;`),
      sql(`begin; ${invoke(orgB, branchB, ` ${sku.toLowerCase()} `)} select pg_sleep(0.12); commit;`),
    ]);
    assert.ok(results.every(r => r.code === 0), results.map(r => r.stderr).join('\n'));
    crossOrg++;
  }
  const count = Number(await ok(`select count(*) from public.products where organization_id in (${owned});`));
  assert.equal(count, 36);
  // Winners have every side effect exactly once; losers leave no partial graph.
  await ok(`do $$ begin
    if exists(select 1 from public.products p where p.organization_id in (${owned}) and (
      p.stock_quantity<>1 or
      (select count(*) from public.branch_inventory b where b.product_id=p.id)<>1 or
      (select coalesce(sum(b.stock_quantity),0) from public.branch_inventory b where b.product_id=p.id)<>1 or
      (select count(*) from public.product_movements m where m.product_id=p.id and m.movement_type='initial')<>1 or
      (select count(*) from public.product_batches b where b.product_id=p.id and b.quantity=1)<>1
    )) then raise exception 'SKU_RACE_PARTIAL_GRAPH'; end if;
    if exists(select 1 from public.branch_inventory b left join public.products p on p.id=b.product_id where b.branch_id in ('${branchA}','${branchB}') and p.id is null)
      or exists(select 1 from public.product_movements m left join public.products p on p.id=m.product_id where m.organization_id in (${owned}) and p.id is null)
      or exists(select 1 from public.product_batches b left join public.products p on p.id=b.product_id where b.organization_id in (${owned}) and p.id is null)
    then raise exception 'SKU_RACE_ORPHAN'; end if;
  end $$;`);
  console.log(JSON.stringify({ sameOrganizationRaces: `${sameOrg}/12 PASS`, crossOrganizationRaces: `${crossOrg}/12 PASS`, committedProducts: count, atomicity: 'PASS' }));
} finally {
  await ok(`begin;
    delete from public.products where organization_id in (${owned});
    commit;`);
  assert.equal(Number(await ok(`select
    (select count(*) from public.products where organization_id in (${owned})) +
    (select count(*) from public.branch_inventory where branch_id in ('${branchA}','${branchB}')) +
    (select count(*) from public.product_movements where organization_id in (${owned})) +
    (select count(*) from public.product_batches where organization_id in (${owned}));`)), 0);
  console.log('Synthetic product graph cleanup: PASS; discard the disposable DB to remove tenant audit fixtures.');
}
