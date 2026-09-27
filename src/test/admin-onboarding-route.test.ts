import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('admin onboarding route migration', () => {
  it('serves onboarding from the admin section', () => {
    const newPage = 'src/app/admin/onboarding/page.tsx'

    expect(existsSync(resolve(process.cwd(), newPage))).toBe(true)
    expect(read(newPage)).toContain('OnboardingClient')
    expect(read('src/config/admin-navigation.ts')).toContain("href: '/admin/onboarding'")
  })

  it('keeps the old dashboard URL as a compatibility redirect', () => {
    const legacyPage = read('src/app/dashboard/onboarding/page.tsx')

    expect(legacyPage).toContain("redirect('/admin/onboarding')")
    expect(legacyPage).not.toContain('OnboardingClient')
  })

  it('migrates runtime consumers to the canonical admin URL', () => {
    const runtimeFiles = [
      'src/app/register/page.tsx',
      'src/app/api/auth/register-company/provisioning.ts',
      'src/app/api/superadmin/organizations/route.ts',
      'src/app/api/superadmin/organizations/[id]/owner/route.ts',
      'src/components/dashboard/DashboardGuard.tsx',
      'src/components/dashboard/onboarding/OnboardingClient.tsx',
      'src/components/dashboard/sidebar.tsx',
      'src/lib/guide/first-steps.ts',
      'src/lib/guide/content.ts',
    ]

    for (const file of runtimeFiles) {
      expect(read(file), file).not.toContain('/dashboard/onboarding')
    }
  })
})
