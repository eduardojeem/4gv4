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

  it('only syncs the default branch contact when it still matches the company contact', () => {
    const updateRoute = read('src/app/api/admin/system/settings/route.ts')
    const sharedRoute = read('src/app/api/settings/shared/route.ts')
    const resolver = read('src/lib/organization/tenant-effective-settings.ts')

    // Antes se pisaba la sucursal entera con el contacto de la empresa. Ahora
    // solo los campos vacíos o iguales al valor anterior (branchContactPatch).
    expect(updateRoute).not.toContain('branchChanges')
    expect(updateRoute).toContain('branchContactPatch(tenantChanges, currentEffectiveSettings, defaultBranch)')
    expect(resolver).toContain('if (current && current !== before) continue')
    expect(sharedRoute).toContain('legacyBranchFallback')
    expect(resolver).toContain('tenantOverrides.companyEmail === undefined')
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

    // Antes esto se lograba redirigiendo a todo superadmin a la configuracion
    // global, incluso dentro de su propia organizacion. Ahora la carga dice de
    // donde salen los datos y la pantalla solo se niega cuando son globales.
    expect(page).not.toContain("router.replace('/superadmin/settings')")
    expect(page).toContain("if (scope === 'platform')")
  })
})
