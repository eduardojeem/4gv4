import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getTenantAdminSettings,
  mergeTenantAdminSettings,
} from '@/lib/organization/admin-settings'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('onboarding and admin settings synchronization', () => {
  it('preserves unrelated modules while updating canonical organization fields', () => {
    const modules = {
      inventory: { enabled: true },
      admin_settings: { companyPhone: 'old', taxRate: 10 },
    }
    const merged = mergeTenantAdminSettings(modules, {
      companyPhone: 'new',
      companyRuc: '123-4',
    })

    expect(merged.inventory).toEqual({ enabled: true })
    expect(getTenantAdminSettings(merged)).toMatchObject({
      companyPhone: 'new',
      companyRuc: '123-4',
      taxRate: 10,
    })
  })

  it('uses the active organization in both onboarding reads and writes', () => {
    const page = read('src/app/dashboard/onboarding/page.tsx')
    const route = read('src/app/api/onboarding/complete/route.ts')
    const status = read('src/app/api/onboarding/status/route.ts')

    expect(page).toContain('getCurrentOrganizationContext(user.id)')
    expect(route).toContain('getCurrentOrganizationContext(user.id)')
    expect(status).toContain('getCurrentOrganizationContext(user.id)')
    expect(route).not.toContain(".order('created_at', { ascending: true })")
  })

  it('shares regional schemas and requires currency confirmation', () => {
    const route = read('src/app/api/onboarding/complete/route.ts')
    const client = read('src/components/dashboard/onboarding/OnboardingClient.tsx')

    expect(route).toContain('SupportedCurrencySchema')
    expect(route).toContain('SupportedLanguageSchema')
    expect(route).toContain('CURRENCY_CHANGE_CONFIRMATION_REQUIRED')
    expect(client).toContain('SUPPORTED_CURRENCIES.map')
    expect(client).toContain('confirmCurrencyChange')
  })

  it('persists onboarding through the atomic database function', () => {
    const route = read('src/app/api/onboarding/complete/route.ts')
    const migration = read('supabase/migrations/20260801183000_complete_onboarding_atomic.sql')

    expect(route).toContain("'complete_organization_onboarding'")
    expect(migration).toContain('create or replace function public.complete_organization_onboarding')
    expect(migration).toContain('insert into public.organization_settings')
    expect(migration).toContain('insert into public.website_settings')
  })

  it('presents onboarding as a focused configuration workspace', () => {
    const client = read('src/components/dashboard/onboarding/OnboardingClient.tsx')

    expect(client).toContain("<TabsTrigger value=\"essential\"")
    expect(client).toContain("<TabsTrigger value=\"public\"")
    expect(client).toContain("<TabsTrigger value=\"social\"")
    expect(client).toContain('clearOnboardingStatusCache()')
    expect(client).toContain("if (isRevisit) router.refresh()")
    expect(client).toContain("window.addEventListener('beforeunload'")
    expect(client).not.toContain('Siguiente paso recomendado')
  })

  it('invalidates onboarding status when the active organization changes', () => {
    const switcher = read('src/components/saas/organization-switcher.tsx')

    expect(switcher).toContain('clearOnboardingStatusCache()')
    expect(switcher.indexOf('clearOnboardingStatusCache()')).toBeLessThan(
      switcher.indexOf("window.dispatchEvent(new CustomEvent('organization:changed'")
    )
  })
})
