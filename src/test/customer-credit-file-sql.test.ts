import { execFile, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const exec = promisify(execFile)
const dockerArgs = ['--context', 'desktop-linux', 'exec', '-i', 'supabase_db_4gv4', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
const org = 'cf110000-0000-4000-8000-000000000001'
const customer = 'cf210000-0000-4000-8000-000000000001'
const actor = 'cf010000-0000-4000-8000-000000000001'
const concede = `select public.create_customer_credit_account_atomic('${org}','${customer}','${actor}',
 '{"principal":120,"interest_rate":0,"term_months":1,"credit_type":"manual","origin_type":"manual","label":"Concurrency fixture","metadata":{}}',
 '[{"installment_number":1,"due_date":"2030-01-01T00:00:00Z","amount":120,"principal_component":120,"interest_component":0}]');`

function psql(sql: string, onOutput?: (text: string) => void) {
  const child = spawn('docker', dockerArgs, { windowsHide: true })
  const timeout = setTimeout(() => child.kill(), 20_000)
  const done = new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    let output = ''
    child.stdout.on('data', data => { output += String(data); onOutput?.(String(data)) })
    child.stderr.on('data', data => { output += String(data) })
    child.on('error', reject)
    child.on('close', code => { clearTimeout(timeout); resolve({ code, output }) })
  })
  child.stdin.end(sql)
  return { done, child }
}

// Deliberately opt-in: never connects to linked/remote Supabase or mutates real customers.
describe.skipIf(process.env.CREDIT_FILE_LOCAL_SQL !== '1')('customer credit file — real local Postgres', () => {
  it('enforces permissions, tenant FK, versions, atomic decisions and current requirements', async () => {
    const fixture = await readFile('supabase/tests/customer_credit_file.test.sql', 'utf8')
    const result = await psql(fixture).done
    expect(result.output).toContain('ROLLBACK')
    expect(result.code, result.output).toBe(0)
  }, 30_000)

  it('serializes two connections so the second cannot exceed the customer limit', async () => {
    const inventory = await exec('docker', ['--context', 'desktop-linux', 'ps', '--filter', 'name=^supabase_db_4gv4$', '--format', '{{.Names}}'])
    expect(inventory.stdout.trim()).toBe('supabase_db_4gv4')
    const seed = await psql(`begin;
      -- Only the fake membership seed omits unrelated immutable payroll auditing.
      -- Real concession transactions below use normal triggers and FK checks.
      set local session_replication_role=replica;
      insert into auth.users(id) values('${actor}');
      insert into public.organizations(id,name,slug) values('${org}','Credit concurrency fixture','credit-concurrency-fixture');
      insert into public.organization_members(organization_id,user_id,role) values('${org}','${actor}','owner');
      insert into public.customers(id,organization_id,name,status,credit_limit) values('${customer}','${org}','Concurrency fixture','activo',200);
      commit;`).done
    expect(seed.code, seed.output).toBe(0)
    try {
      let releaseLockHeld!: () => void
      const lockHeld = new Promise<void>(resolve => { releaseLockHeld = resolve })
      const first = psql(`begin; set local role service_role; ${concede}
        select 'LOCK_HELD'; select pg_sleep(2); commit;`, text => { if (text.includes('LOCK_HELD')) releaseLockHeld() })
      await Promise.race([lockHeld, first.done.then(result => { throw new Error(`First transaction ended before lock signal: ${result.output}`) })])
      const second = psql(`begin; set local role service_role; ${concede} commit;`)
      const [firstResult, secondResult] = await Promise.all([first.done, second.done])
      expect(firstResult.code, firstResult.output).toBe(0)
      expect(secondResult.code, secondResult.output).not.toBe(0)
      expect(secondResult.output).toContain('CREDIT_LIMIT_EXCEEDED')
      const balance = await psql(`select public.customer_credit_outstanding('${org}','${customer}');
        select count(*) from public.customer_credits where organization_id='${org}';`).done
      expect(balance.output).toMatch(/\b120\b/)
      expect(balance.output).toMatch(/\b1\b/)
    } finally {
      // Exact, reserved fixture IDs only, and only after our successful seed.
      const cleanup = await psql(`begin;
        delete from public.credit_installments where credit_id in(select id from public.customer_credits where organization_id='${org}' and customer_id='${customer}');
        delete from public.customer_credits where organization_id='${org}' and customer_id='${customer}';
        delete from public.customers where id='${customer}' and organization_id='${org}' and name='Concurrency fixture';
        delete from public.organization_members where organization_id='${org}' and user_id='${actor}';
        delete from public.organizations where id='${org}' and slug='credit-concurrency-fixture';
        delete from auth.users where id='${actor}'; commit;`).done
      expect(cleanup.code, cleanup.output).toBe(0)
    }
  }, 30_000)
})
