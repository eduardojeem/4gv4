import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('admin settings contract', () => {
  it('persists only fields changed by the administrator', () => {
    const hook = read('src/hooks/use-shared-settings.ts')

    expect(hook).toContain('const changedSettings =')
    expect(hook).toContain('JSON.stringify(settings[key])')
    expect(hook).toContain('settings: changedSettings')
    expect(hook).toContain('confirmCurrencyChange: options.confirmCurrencyChange === true')
  })

  it('does not store organization contact data in the default branch', () => {
    const updateRoute = read('src/app/api/admin/system/settings/route.ts')
    const sharedRoute = read('src/app/api/settings/shared/route.ts')

    expect(updateRoute).not.toContain('branchChanges')
    expect(updateRoute).not.toContain(".from('branches')")
    expect(sharedRoute).toContain('legacyBranchFallback')
    expect(sharedRoute).toContain('tenantOverrides.companyEmail === undefined')
  })

  it('validates regional settings as closed option sets', () => {
    const schema = read('src/lib/validations/system-settings.ts')

    expect(schema).toContain("dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])")
    expect(schema).toContain('SupportedCurrencySchema')
    expect(schema).toContain('SupportedLanguageSchema')
    expect(schema).toContain('isValidTimeZone')
  })

  it('requires explicit confirmation before changing the tenant currency', () => {
    const route = read('src/app/api/admin/system/settings/route.ts')

    expect(route).toContain('confirmCurrencyChange')
    expect(route).toContain('CURRENCY_CHANGE_CONFIRMATION_REQUIRED')
    expect(route).toContain('status: 409')
  })

  it('keeps platform defaults out of the organization settings screen', () => {
    const page = read('src/app/admin/settings/page.tsx')

    expect(page).toContain("router.replace('/superadmin/settings')")
    expect(page).toContain('isSuperAdmin')
  })
})
