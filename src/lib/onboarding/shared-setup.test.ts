import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createInitialOnboardingState,
  deriveOnboardingChecklist,
  getFirstIncompleteStep,
  getRegionalSelection,
  mergeOnboardingProgress,
  normalizeOnboardingState,
  suggestOnboardingPreferences,
  validateBusinessStep,
  validateBranchStep,
  visibleEntitledModules,
  type SharedOnboardingState,
} from './shared-setup'

const base = (): SharedOnboardingState => createInitialOnboardingState({
  plan: 'pro',
  businessName: 'Comercial Central',
  businessCategory: 'electronics',
})

describe('contrato único de onboarding compartido', () => {
  it('inicia una organización nueva en el paso de negocio con plan y datos registrados', () => {
    expect(base()).toMatchObject({ currentStep: 2, completedSteps: ['plan'], completed: false, data: { plan: 'pro' } })
  })

  it('exige país y categoría junto al nombre del negocio', () => {
    expect(validateBusinessStep({ businessName: 'Tienda', countryCode: '', businessCategory: '' }).fields).toEqual(expect.arrayContaining(['countryCode', 'businessCategory']))
  })

  it('sugiere PYG, Asunción y es-PY para Paraguay', () => {
    expect(getRegionalSelection('PY')).toMatchObject({ baseCurrency: 'PYG', timezone: 'America/Asuncion', locale: 'es-PY', timezoneSelectionRequired: false })
  })

  it('exige elegir explícitamente la zona horaria de Estados Unidos', () => {
    expect(getRegionalSelection('US')).toMatchObject({ baseCurrency: 'USD', locale: 'en-US', timezone: null, timezoneSelectionRequired: true })
    expect(validateBusinessStep({ businessName: 'Shop', countryCode: 'US', businessCategory: 'general', currency: 'USD', timezone: '', locale: 'en-US' }).fields).toContain('timezone')
  })

  it('persiste y normaliza el progreso en el sobre compartido del servidor', () => {
    const saved = mergeOnboardingProgress({ unrelated: { keep: true } }, base(), 2)
    expect(saved.unrelated).toEqual({ keep: true })
    expect(normalizeOnboardingState((saved.onboarding as Record<string, unknown>).shared)).toMatchObject({ currentStep: 2, data: { businessName: 'Comercial Central' } })
  })

  it('expone exactamente el mismo estado normalizado a cualquier cliente', () => {
    const state = base()
    const payload = JSON.parse(JSON.stringify(state)) as SharedOnboardingState
    expect(normalizeOnboardingState(payload)).toEqual(state)
  })

  it('valida sucursal por nombre y localidad, sin exigir campos de contacto opcionales', () => {
    expect(validateBranchStep({ name: 'Casa Central', city: 'Luque' })).toEqual({ valid: true, fields: [] })
    expect(validateBranchStep({ name: '', city: '' }).fields).toEqual(['branchName', 'city'])
  })

  it('no duplica pasos al reintentar y reanuda en el primero incompleto', () => {
    const first = mergeOnboardingProgress({}, base(), 2)
    const retry = mergeOnboardingProgress(first, base(), 2)
    expect(retry.onboarding).toEqual(first.onboarding)
    expect(getFirstIncompleteStep(normalizeOnboardingState((retry.onboarding as Record<string, unknown>).shared))).toBe(2)
  })

  it('reintentar la sucursal actualiza la existente y recupera un insert concurrente', () => {
    const route = readFileSync('src/app/api/onboarding/status/route.ts', 'utf8')
    expect(route).toContain(".eq('organization_id', organization.id).eq('is_default', true)")
    expect(route).toContain(".eq('organization_id', organization.id).eq('slug', 'principal')")
    expect(route).toContain("error?.code === '23505'")
    expect(route).toContain(".eq('id', concurrentBranch.id).eq('organization_id', organization.id)")
  })

  it('filtra preferencias de módulos por capacidades efectivas del plan', () => {
    expect(visibleEntitledModules(['pos', 'repairs', 'credits'], ['pos', 'repairs'])).toEqual(['pos', 'repairs'])
  })

  it('suggests electronics tools allowed by the plan', () => {
    expect(suggestOnboardingPreferences('electronics', ['pos', 'inventory', 'repairs'])).toEqual(['pos', 'inventory', 'repairs'])
  })

  it('recalculates recommendations for the selected category', () => {
    expect(suggestOnboardingPreferences('food', ['pos', 'inventory', 'ecommerce'])).toEqual(['pos', 'inventory', 'marketplace'])
  })

  it('omits category suggestions excluded by plan entitlements', () => {
    expect(suggestOnboardingPreferences('electronics', ['pos', 'inventory'])).toEqual(['pos', 'inventory'])
  })

  it('no exige campos opcionales para completar el onboarding', () => {
    const state = base()
    expect(validateBranchStep({ name: 'Casa Central', city: 'Luque', address: '', phone: '', hours: '' }).valid).toBe(true)
    expect(state.completed).toBe(false)
  })

  it('solo desbloquea el dashboard después del paso Ready', () => {
    const state = normalizeOnboardingState({
      ...base(),
      currentStep: 5,
      completedSteps: ['plan', 'business', 'branch', 'modules'],
      data: {
        ...base().data,
        countryCode: 'PY', businessCategory: 'electronics', currency: 'PYG', timezone: 'America/Asuncion', locale: 'es-PY', regionalConfirmed: true,
        primaryBranch: { id: 'branch-1', name: 'Casa Central', city: 'Luque', address: '', phone: '', hours: '' },
        selectedModules: [],
      },
    })
    expect(getFirstIncompleteStep(state)).toBe(5)
    expect(normalizeOnboardingState({ ...state, completed: true }).completed).toBe(true)
  })

  it('mantiene el país heredado nulo como una recomendación no bloqueante', () => {
    const checklist = deriveOnboardingChecklist({ countryCode: null, businessName: 'Antigua', branchExists: true, logoExists: false, productsCount: 1, memberCount: 1, paymentConfigured: false, billingConfigured: false, storefrontConfigured: false, marketplaceConfigured: false })
    expect(checklist.needsCountryConfirmation).toBe(true)
    expect(checklist.blocked).toBe(false)
    expect(checklist.items.find((item) => item.key === 'country')?.required).toBe(false)
  })

  it('deriva elementos checklist desde condiciones reales, no porcentajes guardados', () => {
    const checklist = deriveOnboardingChecklist({ countryCode: 'PY', businessName: 'Nueva', branchExists: true, logoExists: true, productsCount: 2, memberCount: 2, paymentConfigured: true, billingConfigured: false, storefrontConfigured: false, marketplaceConfigured: false })
    expect(checklist.percent).toBe(67)
    expect(checklist.items.filter((item) => item.done).map((item) => item.key)).toEqual(['country', 'company', 'branch', 'logo', 'product', 'team', 'payments'])
  })

  it('resume y guardado usan el mismo contrato compartido desde Web y Mobile', () => {
    expect(readFileSync('src/app/admin/onboarding/page.tsx', 'utf8')).toContain('shared-setup')
    expect(readFileSync('mobile/src/app/onboarding.tsx', 'utf8')).toContain('shared-setup')
  })
})
