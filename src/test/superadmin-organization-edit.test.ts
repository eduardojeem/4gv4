import { describe, expect, it } from 'vitest'
import { organizationEditDefaults, buildOrganizationPatch, normalizeOrganizationSearch } from '@/lib/superadmin/organization-edit'
const original = { name: 'Mi empresa', slug: 'mi-empresa', plan: 'PRO', subscription_status: 'active', enabled_modules: null }
describe('edición de organizaciones sin efectos secundarios', () => {
  it('cambiar solo nombre preserva plan, herencia, moneda y zona horaria no cargadas', () => {
    const draft = { ...organizationEditDefaults(original), name: 'Nuevo nombre' }
    expect(buildOrganizationPatch(original, draft)).toEqual({ name: 'Nuevo nombre' })
  })
  it('no inventa cambios al abrir ni por orden de módulos', () => {
    expect(buildOrganizationPatch(original, organizationEditDefaults(original))).toEqual({})
    const custom = { ...original, enabled_modules: ['pos', 'repairs'] }
    expect(buildOrganizationPatch(custom, { ...organizationEditDefaults(custom), enabled_modules: ['repairs', 'pos'] })).toEqual({})
  })
  it('distingue desactivar todos de mantener lo heredado', () => {
    expect(buildOrganizationPatch(original, { ...organizationEditDefaults(original), enabled_modules: [] })).toEqual({ enabled_modules: [] })
  })
  it('envía cambios explícitos de moneda y cancelación sin cambiar el plan', () => {
    expect(buildOrganizationPatch(original, { ...organizationEditDefaults(original), currency: 'USD', cancel_at_period_end: true })).toEqual({ currency: 'USD', cancel_at_period_end: true })
  })
  it('permite buscar con o sin acentos', () => {
    expect(normalizeOrganizationSearch('  Tecnología Ñandú ')).toBe('tecnologia nandu')
  })
})
