import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('onboarding v2 database contract', () => {
  const migrationPaths = readdirSync(resolve(process.cwd(), 'supabase/migrations')).filter((name) => name.includes('onboarding_atomic_progress_v2'))
  const migrationPath = migrationPaths[0]
  const migrations = migrationPath ? read(`supabase/migrations/${migrationPath}`) : ''
  const allMigrations = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260927000000_baseline_schema.sql'), 'utf8')
  const concurrencyHarness = read('supabase/tests/onboarding_atomicity_v2.concurrency.mjs')

  it('uses a separate revision and versioned RPCs without replacing the legacy function', () => {
    expect(migrationPaths).toHaveLength(1)
    expect(migrations).toMatch(/add column if not exists onboarding_revision bigint not null default 0/i)
    expect(migrations).toContain('save_organization_onboarding_progress_v2')
    expect(migrations).toContain('complete_organization_onboarding_v2')
    expect(migrations).toContain('merge_organization_admin_settings_v2')
    expect(allMigrations).toContain('complete_organization_onboarding"')
  })

  it('serializes progress writes, rejects stale revisions and changes only the onboarding subtree', () => {
    expect(migrations).toMatch(/for update/i)
    expect(migrations).toContain('ONBOARDING_REVISION_CONFLICT')
    expect(migrations).toContain("'{onboarding}'")
    expect(migrations).toContain('save_organization_onboarding_progress_v2')
  })

  it('acquires onboarding row locks in organization, settings, branch order across legacy and v2 writers', () => {
    const functionBody = (name: string) => {
      const start = migrations.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
      if (start < 0) return ''
      const end = migrations.indexOf('$function$;', start)
      return end < 0 ? '' : migrations.slice(start, end)
    }
    const expectOrder = (body: string, expressions: RegExp[]) => {
      const positions = expressions.map((expression) => body.search(expression))
      expect(positions.every((position) => position >= 0)).toBe(true)
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    }

    const legacy = functionBody('complete_organization_onboarding')
    const save = functionBody('save_organization_onboarding_progress_v2')
    const complete = functionBody('complete_organization_onboarding_v2')
    const admin = functionBody('merge_organization_admin_settings_v2')

    expect(legacy).not.toBe('')
    expectOrder(legacy, [
      /FROM public\.organizations AS o[\s\S]*?FOR (?:NO KEY )?UPDATE/i,
      /FROM public\.organization_settings AS s[\s\S]*?FOR UPDATE/i,
      /FROM public\.branches AS b[\s\S]*?FOR UPDATE/i,
      /INSERT INTO public\.website_settings/i,
    ])
    expectOrder(save, [
      /FROM public\.organizations AS o[\s\S]*?FOR (?:NO KEY )?UPDATE/i,
      /FROM public\.organization_settings AS s[\s\S]*?FOR UPDATE/i,
      /FROM public\.branches AS b[\s\S]*?FOR UPDATE/i,
    ])
    expectOrder(complete, [
      /FROM public\.organizations AS o[\s\S]*?FOR (?:NO KEY )?UPDATE/i,
      /FROM public\.organization_settings AS s[\s\S]*?FOR UPDATE/i,
      /public\.complete_organization_onboarding\(/i,
    ])
    expectOrder(admin, [
      /FROM public\.organizations AS o[\s\S]*?FOR (?:NO KEY )?UPDATE/i,
      /FROM public\.organization_settings AS s[\s\S]*?FOR UPDATE/i,
      /INSERT INTO public\.organization_settings/i,
    ])
  })

  it('checks canonical business, branch, module and regional values before atomic completion', () => {
    expect(migrations).toContain("step.value = 'business'")
    expect(migrations).toContain("step.value = 'branch'")
    expect(migrations).toContain("step.value = 'modules'")
    expect(migrations).toContain('ONBOARDING_CANONICAL_DATA_MISMATCH')
    expect(migrations).toContain('p_country_code IS DISTINCT FROM')
    expect(migrations).toContain('The legacy RPC copies these canonical publication values')
  })

  it('restricts v2 execution to service_role and pins SECURITY DEFINER search paths', () => {
    expect(migrations.match(/security definer\s+set search_path = ''/gi)?.length).toBeGreaterThanOrEqual(3)
    expect(migrations.match(/revoke all on function public\.(save_organization_onboarding_progress_v2|complete_organization_onboarding_v2|merge_organization_admin_settings_v2)/gi)?.length).toBeGreaterThanOrEqual(3)
    expect(migrations.match(/grant execute on function public\.(save_organization_onboarding_progress_v2|complete_organization_onboarding_v2|merge_organization_admin_settings_v2).*to service_role/gi)?.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps a guarded real two-session concurrency harness for local disposable PostgreSQL', () => {
    expect(concurrencyHarness).toContain("new Set(['localhost', '127.0.0.1', '::1'])")
    expect(concurrencyHarness).toContain("'mitiendapy_onboarding_concurrency_test'")
    expect(concurrencyHarness).toContain('class PsqlSession')
    expect(concurrencyHarness).toContain("waitForPgSleep('onboarding_legacy_lock_test', legacy)")
    expect(concurrencyHarness).toContain('ONBOARDING_REVISION_CONFLICT')
    expect(concurrencyHarness).toContain('complete_organization_onboarding_v2')
    expect(concurrencyHarness).toContain('Progress Preserved|synthetic-admin-value')
    expect(concurrencyHarness).toContain('40P01')
    expect(concurrencyHarness).toContain('the harness will not apply migrations')
  })
})

describe('onboarding v2 API and clients', () => {
  const statusRoute = read('src/app/api/onboarding/status/route.ts')
  const completeRoute = read('src/app/api/onboarding/complete/route.ts')
  const adminSettingsRoute = read('src/app/api/admin/system/settings/route.ts')
  const webWizard = read('src/components/dashboard/onboarding/SharedOnboardingWizard.tsx')
  const mobileWizard = read('mobile/src/app/onboarding.tsx')

  it('returns and requires the revision, mapping stale writes to HTTP 409', () => {
    expect(statusRoute).toContain('onboarding_revision')
    expect(statusRoute).toContain('expected_revision')
    expect(statusRoute).toContain("status: 409")
    expect(statusRoute).toContain('ONBOARDING_REVISION_CONFLICT')
    expect(completeRoute).toContain('complete_organization_onboarding_v2')
    expect(completeRoute).toContain('expected_revision')
  })

  it('does not write onboarding modules or branches outside the serialized RPC', () => {
    const patchBody = statusRoute.slice(statusRoute.indexOf('export async function PATCH'))
    expect(patchBody).toContain('save_organization_onboarding_progress_v2')
    expect(patchBody).not.toContain(".from('branches').insert")
    expect(patchBody).not.toContain(".from('organization_settings').update({ modules:")
  })

  it('merges admin settings atomically without writing a stale modules document', () => {
    expect(adminSettingsRoute).toContain('merge_organization_admin_settings_v2')
    expect(adminSettingsRoute).not.toContain('.upsert(organizationUpdate')
    expect(adminSettingsRoute).not.toContain(".from('organizations').update({ name:")
  })

  it('sends revisions and refreshes state on conflicts in Web and Mobile', () => {
    expect(webWizard).toContain('expectedRevision')
    expect(webWizard).toContain('Tu configuración fue actualizada desde otro dispositivo')
    expect(mobileWizard).toContain('expectedRevision')
    expect(mobileWizard).toContain('Tu configuración fue actualizada desde otro dispositivo')
  })
})
