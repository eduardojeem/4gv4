#!/usr/bin/env node
// Real multi-session regression harness. It never applies migrations.
// Run only after the disposable database has been provisioned with the current schema.
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const requiredDatabaseName = 'mitiendapy_onboarding_concurrency_test'
const databaseUrl = process.env.ONBOARDING_TEST_DATABASE_URL
const psqlBin = process.env.PSQL_BIN || 'psql'

if (!databaseUrl) {
  throw new Error('Set ONBOARDING_TEST_DATABASE_URL to the dedicated local onboarding test database.')
}

const parsedUrl = new URL(databaseUrl)
const hostname = parsedUrl.hostname.toLowerCase()
const allowedHosts = new Set(['localhost', '127.0.0.1', '::1'])
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''))
if (!allowedHosts.has(hostname) || databaseName !== requiredDatabaseName) {
  throw new Error(`Refusing non-local or non-dedicated target; expected localhost/${requiredDatabaseName}.`)
}

const connection = {
  host: hostname,
  port: parsedUrl.port || '5432',
  user: decodeURIComponent(parsedUrl.username || 'postgres'),
  database: databaseName,
  password: decodeURIComponent(parsedUrl.password),
  sslmode: parsedUrl.searchParams.get('sslmode') || 'disable',
}

function psqlEnv(applicationName) {
  return {
    ...process.env,
    PGPASSWORD: connection.password,
    PGSSLMODE: connection.sslmode,
    PGAPPNAME: applicationName,
  }
}

function psqlArgs() {
  return [
    '--no-psqlrc', '--quiet', '--tuples-only', '--no-align',
    '--set', 'ON_ERROR_STOP=1',
    '--set', 'VERBOSITY=verbose',
    '--host', connection.host,
    '--port', connection.port,
    '--username', connection.user,
    '--dbname', connection.database,
  ]
}

function runSql(sql, applicationName = 'onboarding_test_setup') {
  const result = spawnSync(psqlBin, [...psqlArgs(), '--command', sql], {
    encoding: 'utf8',
    env: psqlEnv(applicationName),
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`psql failed (${result.status}): ${result.stderr.trim()}`)
  return result.stdout.trim()
}

class PsqlSession {
  constructor(applicationName) {
    this.child = spawn(psqlBin, psqlArgs(), {
      env: psqlEnv(applicationName),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.buffer = ''
    this.stderr = ''
    this.pending = null
    this.sequence = 0
    this.child.stdout.setEncoding('utf8')
    this.child.stderr.setEncoding('utf8')
    this.child.stdout.on('data', (chunk) => this.consume(chunk))
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk })
    this.child.on('error', (error) => this.rejectPending(error))
    this.child.on('exit', (code) => {
      if (this.pending) {
        this.rejectPending(new Error(`psql exited (${code}): ${this.stderr.trim()}`))
      }
    })
  }

  consume(chunk) {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''
    for (const line of lines) {
      if (!this.pending) continue
      if (line === this.pending.marker) {
        const completed = this.pending
        this.pending = null
        completed.resolve(completed.lines.join('\n').trim())
      } else {
        this.pending.lines.push(line)
      }
    }
  }

  rejectPending(error) {
    if (!this.pending) return
    const pending = this.pending
    this.pending = null
    pending.reject(error)
  }

  exec(sql) {
    if (this.pending) throw new Error('Only one in-flight command is supported per psql session.')
    const marker = `__ONBOARDING_RESULT_${++this.sequence}__`
    const result = new Promise((resolve, reject) => {
      this.pending = { marker, lines: [], resolve, reject }
    })
    this.child.stdin.write(`${sql}\n\\g\n\\echo ${marker}\n`)
    return result
  }

  async close() {
    if (this.child.exitCode !== null) return
    this.child.stdin.end('\\q\n')
    await new Promise((resolve) => this.child.once('exit', resolve))
  }
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const json = (value) => quote(JSON.stringify(value)) + '::jsonb'
const fixtures = []
const sessions = []
let cleanupAllowed = false

function fixtureModules(ready = false) {
  const data = ready
    ? {
        businessName: 'Synthetic Concurrent Shop',
        businessCategory: 'general',
        countryCode: 'PY',
        locale: 'es-PY',
        currency: 'PYG',
        timezone: 'America/Asuncion',
        primaryBranch: { name: 'Principal', city: 'Asuncion', address: 'Synthetic address' },
        selectedModules: ['inventory'],
      }
    : {
        businessName: 'Synthetic Shop',
        countryCode: 'PY',
        locale: 'es-PY',
        currency: 'PYG',
        timezone: 'America/Asuncion',
        selectedModules: null,
      }
  const completedSteps = ready ? ['business', 'branch', 'modules'] : ['region']
  return {
    payments: { cash: true },
    admin_settings: { companyPhone: 'before' },
    onboarding: {
      status: 'in_progress',
      shared: { currentStep: ready ? 4 : 2, completedSteps, data },
    },
  }
}

function createFixtureSql({ ready = false } = {}) {
  const id = randomUUID()
  const userId = randomUUID()
  const email = `onboarding-${id}@example.invalid`
  fixtures.push({ id, userId })
  return `
    BEGIN;
    INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (${quote(userId)}::uuid, ${quote(email)}, now(), now(), '{}'::jsonb, '{}'::jsonb);
    INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (${quote(id)}::uuid, 'Synthetic Concurrent Shop', ${quote(`onboarding-${id.slice(0, 24)}`)}, ${quote(userId)}::uuid);
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (${quote(id)}::uuid, ${quote(userId)}::uuid, 'owner', 'active');
    INSERT INTO public.organization_settings (organization_id, display_name, currency, timezone, country_code, locale, modules)
    VALUES (${quote(id)}::uuid, 'Synthetic Concurrent Shop', 'PYG', 'America/Asuncion', 'PY', 'es-PY', ${json(fixtureModules(ready))});
    COMMIT;
  `
}

function functionCall(name, args) {
  return `public.${name}(${args.join(', ')})`
}

function saveCall(orgId, userId, revision, step, payload) {
  return `WITH result AS (SELECT ${functionCall('save_organization_onboarding_progress_v2', [
    `${quote(orgId)}::uuid`, `${quote(userId)}::uuid`, String(revision), String(step), json(payload),
  ])} AS value) SELECT value->>'ok' || '|' || coalesce(value->>'revision', '') || '|' || coalesce(value->>'code', '') FROM result`
}

function adminCall(orgId, userId, companyName, phone) {
  return `SELECT ${functionCall('merge_organization_admin_settings_v2', [
    `${quote(orgId)}::uuid`, `${quote(userId)}::uuid`,
    json({ display_name: companyName, currency: 'PYG', timezone: 'America/Asuncion', country_code: 'PY', locale: 'es-PY', repair_max_discount_percent: 20, repair_labor_tax_rate: 10 }),
    json({ companyPhone: phone }),
  ])}`
}

function completeCall(orgId, userId, revision) {
  return `WITH result AS (SELECT ${functionCall('complete_organization_onboarding_v2', [
    `${quote(orgId)}::uuid`, `${quote(userId)}::uuid`, String(revision),
    quote('Synthetic Concurrent Shop'), quote('PYG'), quote('America/Asuncion'), quote('PY'), quote('es-PY'), quote(''),
    json({ name: 'Principal', city: 'Asuncion', address: 'Synthetic address', phone: '' }),
    json({ name: 'Synthetic Concurrent Shop', hours: { weekdays: '09:00-18:00' } }),
    json({ companyPhone: 'after' }),
    json({ business_vertical: 'general', operating_model: 'retail', enabled_modules: ['inventory'], service_specialties: [] }),
    'true',
  ])} AS value) SELECT value->>'ok' || '|' || coalesce(value->>'revision', '') || '|' || coalesce(value->>'code', '') FROM result`
}

async function waitForPgSleep(applicationName, targetSession, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  const monitor = new PsqlSession('onboarding_test_monitor')
  let lastActivity = 'not found'
  try {
    while (Date.now() < deadline) {
      lastActivity = await monitor.exec(`SELECT coalesce(pg_catalog.string_agg(application_name || '|' || coalesce(wait_event, '') || '|' || state, ';'), 'none') FROM pg_catalog.pg_stat_activity WHERE datname = current_database() AND usename = current_user`)
      if (lastActivity.includes(`${applicationName}|PgSleep|`)) return
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error(`Timed out waiting for the synthetic lock barrier (${applicationName}); last activity: ${lastActivity || 'not found'}; psql exit: ${targetSession.child.exitCode}; stderr: ${targetSession.stderr.trim() || 'none'}; output buffer: ${targetSession.buffer.trim() || 'empty'}.`)
  } finally {
    await monitor.close()
  }
}

function installPauseTriggers() {
  runSql(`
    CREATE SCHEMA onboarding_concurrency_test;
    CREATE FUNCTION onboarding_concurrency_test.pause_selected_test_session()
    RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $body$
    BEGIN
      IF current_setting('application_name') IN ('onboarding_legacy_lock_test', 'onboarding_progress_lock_test', 'onboarding_complete_lock_test') THEN
        PERFORM pg_catalog.pg_sleep(2);
      END IF;
      RETURN NEW;
    END;
    $body$;
    CREATE TRIGGER onboarding_concurrency_pause_org AFTER UPDATE ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION onboarding_concurrency_test.pause_selected_test_session();
    CREATE TRIGGER onboarding_concurrency_pause_settings BEFORE UPDATE ON public.organization_settings
      FOR EACH ROW EXECUTE FUNCTION onboarding_concurrency_test.pause_selected_test_session();
  `)
}

function cleanup() {
  runSql(`
    DROP TRIGGER IF EXISTS onboarding_concurrency_pause_org ON public.organizations;
    DROP TRIGGER IF EXISTS onboarding_concurrency_pause_settings ON public.organization_settings;
    DROP SCHEMA IF EXISTS onboarding_concurrency_test CASCADE;
  `)
  // Membership inserts create append-only payroll/audit rows in the real
  // baseline, so fixture rows stay only in this dedicated disposable DB.
  // The caller must destroy its container/database after all iterations.
}

async function readRevision(session, orgId) {
  const value = await session.exec(`SELECT onboarding_revision FROM public.organization_settings WHERE organization_id = ${quote(orgId)}::uuid`)
  if (!/^\d+$/.test(value)) throw new Error(`Unexpected revision result: ${value}`)
  return Number(value)
}

async function run() {
  const identity = runSql("SELECT current_database() || '|' || current_setting('server_version_num')")
  const [actualDatabase, versionNum] = identity.split('|')
  if (actualDatabase !== requiredDatabaseName) throw new Error('Database identity check failed; no fixtures were created.')
  if (Number(versionNum) < 150000) throw new Error('PostgreSQL 15 or newer is required for this harness.')
  const functions = runSql(`SELECT count(*) FROM pg_catalog.pg_proc WHERE oid IN (
    'public.save_organization_onboarding_progress_v2(uuid,uuid,bigint,integer,jsonb)'::regprocedure,
    'public.complete_organization_onboarding_v2(uuid,uuid,bigint,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean)'::regprocedure,
    'public.merge_organization_admin_settings_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
    'public.complete_organization_onboarding(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb)'::regprocedure
  )`)
  if (functions !== '4') throw new Error('Required RPCs are not installed; the harness will not apply migrations.')
  const preexistingTestObjects = runSql(`SELECT
    (SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname = 'onboarding_concurrency_test')
    + (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgname IN ('onboarding_concurrency_pause_org', 'onboarding_concurrency_pause_settings') AND NOT tgisinternal)`)
  if (preexistingTestObjects !== '0') throw new Error('A prior concurrency-test artifact exists; inspect it manually before running again.')

  installPauseTriggers()
  cleanupAllowed = true

  // Legacy completion vs. admin merge used to take organization/settings locks in opposite order.
  runSql(createFixtureSql())
  const deadlockFixture = fixtures.at(-1)
  const legacy = new PsqlSession('onboarding_legacy_lock_test')
  const admin = new PsqlSession('onboarding_admin_lock_test')
  sessions.push(legacy, admin)
  const legacyResult = legacy.exec(`SELECT public.complete_organization_onboarding(
    ${quote(deadlockFixture.id)}::uuid, ${quote(deadlockFixture.userId)}::uuid,
    'Synthetic Legacy', 'PYG', 'America/Asuncion', '', ${json({ onboarding: { status: 'completed' } })},
    ${json({ address: 'Synthetic', city: 'Asuncion', phone: '', email: '' })}, ${json({ name: 'Synthetic' })}
  )`)
  await waitForPgSleep('onboarding_legacy_lock_test', legacy)
  const adminResult = admin.exec(adminCall(deadlockFixture.id, deadlockFixture.userId, 'Synthetic Admin', 'synthetic-only'))
  const [legacyOutput, adminOutput] = await Promise.all([legacyResult, adminResult])
  if (!legacyOutput.includes('branch_id') || !adminOutput.includes('ok')) throw new Error('Legacy/admin overlap did not complete successfully.')
  console.log('PASS legacy completion + admin merge: two independent sessions, no 40P01')
  await Promise.all([legacy.close(), admin.close()])

  // Two sessions read N before either write; exactly one wins and one receives the stable stale result.
  runSql(createFixtureSql())
  const staleFixture = fixtures.at(-1)
  const staleA = new PsqlSession('onboarding_stale_client_a')
  const staleB = new PsqlSession('onboarding_stale_client_b')
  sessions.push(staleA, staleB)
  const [revisionA, revisionB] = await Promise.all([readRevision(staleA, staleFixture.id), readRevision(staleB, staleFixture.id)])
  if (revisionA !== revisionB) throw new Error('Stale clients did not start from the same revision.')
  const [staleResultA, staleResultB] = await Promise.all([
    staleA.exec(saveCall(staleFixture.id, staleFixture.userId, revisionA, 2, { businessName: 'Client A', countryCode: 'PY', locale: 'es-PY', currency: 'PYG', timezone: 'America/Asuncion', selectedModules: null })),
    staleB.exec(saveCall(staleFixture.id, staleFixture.userId, revisionB, 2, { businessName: 'Client B', countryCode: 'PY', locale: 'es-PY', currency: 'PYG', timezone: 'America/Asuncion', selectedModules: null })),
  ])
  const staleResults = [staleResultA, staleResultB]
  if (staleResults.filter((value) => value.startsWith('true|')).length !== 1
      || staleResults.filter((value) => value.endsWith('|ONBOARDING_REVISION_CONFLICT')).length !== 1) {
    throw new Error(`Expected one save and one stale conflict; got ${staleResults.join(', ')}`)
  }
  if (runSql(`SELECT onboarding_revision FROM public.organization_settings WHERE organization_id = ${quote(staleFixture.id)}::uuid`) !== String(revisionA + 1)) {
    throw new Error('Concurrent stale saves lost or duplicated a revision update.')
  }
  console.log('PASS two stale progress writers: one success, one ONBOARDING_REVISION_CONFLICT')
  await Promise.all([staleA.close(), staleB.close()])

  // Progress pauses after holding the organization/settings locks while admin merge overlaps.
  runSql(createFixtureSql())
  const mergeFixture = fixtures.at(-1)
  const progress = new PsqlSession('onboarding_progress_lock_test')
  const adminMerge = new PsqlSession('onboarding_admin_merge_test')
  sessions.push(progress, adminMerge)
  const progressResult = progress.exec(saveCall(mergeFixture.id, mergeFixture.userId, 0, 2, {
    businessName: 'Progress Preserved', countryCode: 'PY', locale: 'es-PY', currency: 'PYG', timezone: 'America/Asuncion', selectedModules: null,
  }))
  await waitForPgSleep('onboarding_progress_lock_test', progress)
  const mergeResult = adminMerge.exec(adminCall(mergeFixture.id, mergeFixture.userId, 'Progress Preserved', 'synthetic-admin-value'))
  await Promise.all([progressResult, mergeResult])
  const mergeState = runSql(`SELECT (modules->'onboarding'->'shared'->'data'->>'businessName') || '|' || (modules->'admin_settings'->>'companyPhone')
    FROM public.organization_settings WHERE organization_id = ${quote(mergeFixture.id)}::uuid`)
  if (mergeState !== 'Progress Preserved|synthetic-admin-value') throw new Error('Admin merge and onboarding progress overwrote one another.')
  console.log('PASS onboarding progress + admin settings: both JSON subtrees preserved')
  await Promise.all([progress.close(), adminMerge.close()])

  // Completion and progress start at the same revision and serialize to one winner + one stale conflict.
  runSql(createFixtureSql({ ready: true }))
  const completionFixture = fixtures.at(-1)
  const completion = new PsqlSession('onboarding_complete_lock_test')
  const progressRace = new PsqlSession('onboarding_progress_race_test')
  sessions.push(completion, progressRace)
  const [completionRevision, progressRevision] = await Promise.all([
    readRevision(completion, completionFixture.id), readRevision(progressRace, completionFixture.id),
  ])
  if (completionRevision !== progressRevision) throw new Error('Completion/progress clients did not start at the same revision.')
  const [completionResult, progressRaceResult] = await Promise.all([
    completion.exec(completeCall(completionFixture.id, completionFixture.userId, completionRevision)),
    progressRace.exec(saveCall(completionFixture.id, completionFixture.userId, progressRevision, 4, { selectedModules: ['inventory', 'repairs'] })),
  ])
  const raceResults = [completionResult, progressRaceResult]
  if (raceResults.filter((value) => value.startsWith('true|')).length !== 1
      || raceResults.filter((value) => value.endsWith('|ONBOARDING_REVISION_CONFLICT')).length !== 1) {
    throw new Error(`Expected exactly one completion/progress winner; got ${raceResults.join(', ')}`)
  }
  const finalRevision = runSql(`SELECT onboarding_revision FROM public.organization_settings WHERE organization_id = ${quote(completionFixture.id)}::uuid`)
  const finalState = runSql(`SELECT coalesce(modules->'onboarding'->>'status', '') || '|' || onboarding_revision::text
    FROM public.organization_settings WHERE organization_id = ${quote(completionFixture.id)}::uuid`)
  if (finalRevision !== String(completionRevision + 1) || !finalState.endsWith(`|${completionRevision + 1}`)) {
    throw new Error('Completion/progress race left a partial or inconsistent revision.')
  }
  const expectedStatus = completionResult.startsWith('true|') ? 'completed' : 'in_progress'
  if (finalState !== `${expectedStatus}|${completionRevision + 1}`) {
    throw new Error('Completion/progress race committed an unexpected onboarding state.')
  }
  console.log('PASS completion + progress: one winner, one stale conflict, no partial state')
  await Promise.all([completion.close(), progressRace.close()])
}

try {
  await run()
} finally {
  for (const session of sessions) await session.close().catch(() => {})
  if (cleanupAllowed) {
    try {
      cleanup()
    } catch (error) {
      console.error('Cleanup failed; remove only the synthetic fixtures and onboarding_concurrency_test triggers from the dedicated local database.', error.message)
      process.exitCode = 1
    }
  }
}
