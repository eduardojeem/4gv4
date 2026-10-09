import { describe, expect, it } from 'vitest'
import { mergePublicPlanCatalog } from './public-plan-catalog'

describe('catálogo público operativo', () => {
  it('conserva precio y prueba, pero muestra límites y módulos técnicos', () => {
    const [plan] = mergePublicPlanCatalog([{ tier: 'basic', is_active: true, price: 120000, trial_days: 7, limits: { products: '999' } }], [{ code: 'BASIC', is_active: true, limits: { products: 500 }, modules: ['inventory'] }])
    expect(plan).toMatchObject({ price: 120000, trial_days: 7, limits: { products: 500 }, modules: ['inventory'] })
  })
  it('no publica planes desactivados o sin configuración técnica verificable', () => {
    expect(mergePublicPlanCatalog([{ tier: 'pro', is_active: true }, { tier: 'free', is_active: true }], [{ code: 'PRO', is_active: false, limits: {}, modules: [] }])).toEqual([])
  })
})
