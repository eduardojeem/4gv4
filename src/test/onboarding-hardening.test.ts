import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearOnboardingDraft,
  isDraftFresh,
  isDraftWorthRestoring,
  onboardingDraftKey,
  readOnboardingDraft,
  writeOnboardingDraft,
  type OnboardingDraft,
} from '@/lib/onboarding/draft'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const hoy = new Date('2026-09-13T10:00:00')
const guardado = { displayName: 'Tienda Aurora', city: 'Asunción' }

const borrador = (extra: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  form: { displayName: 'Tienda Aurora', city: 'Luque' },
  countryCode: '+595',
  localPhone: '981 000 000',
  savedAt: '2026-09-13T09:30:00.000Z',
  ...extra,
})

/**
 * El onboarding guarda una sola vez, al final: si el navegador se cerraba a
 * mitad, se perdia todo lo cargado en tres pestañas de campos.
 */
describe('el borrador de la configuración inicial', () => {
  beforeEach(() => {
    vi.setSystemTime(hoy)
    window.localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('cada organización lleva el suyo', () => {
    expect(onboardingDraftKey('org-1')).not.toBe(onboardingDraftKey('org-2'))
  })

  it('se escribe, se lee y se borra', () => {
    writeOnboardingDraft('org-1', borrador())
    expect(readOnboardingDraft('org-1')).toMatchObject({ countryCode: '+595' })

    clearOnboardingDraft('org-1')
    expect(readOnboardingDraft('org-1')).toBeNull()
  })

  it('un borrador ilegible no rompe el formulario', () => {
    window.localStorage.setItem(onboardingDraftKey('org-1'), '{no es json')
    expect(readOnboardingDraft('org-1')).toBeNull()
  })

  it('se descarta después de una semana', () => {
    expect(isDraftFresh(borrador(), hoy)).toBe(true)
    expect(isDraftFresh(borrador({ savedAt: '2026-09-05T09:00:00.000Z' }), hoy)).toBe(false)
    expect(isDraftFresh(borrador({ savedAt: 'cualquier cosa' }), hoy)).toBe(false)
  })

  it('solo se retoma si difiere de lo ya guardado', () => {
    expect(isDraftWorthRestoring(borrador(), guardado, hoy)).toBe(true)
    expect(isDraftWorthRestoring(borrador({ form: guardado }), guardado, hoy)).toBe(false)
    expect(isDraftWorthRestoring(null, guardado, hoy)).toBe(false)
    expect(isDraftWorthRestoring(borrador({ savedAt: '2026-08-01T09:00:00.000Z' }), guardado, hoy)).toBe(false)
  })
})

describe('la pantalla del onboarding', () => {
  const cliente = leer('src/components/dashboard/onboarding/OnboardingClient.tsx')

  it('la barra de acciones queda por encima de la navegación del panel', () => {
    // El panel dibuja su navegación fija abajo con z-50: antes tapaba el botón.
    expect(leer('src/components/dashboard/mobile-nav.tsx')).toContain('fixed bottom-0 left-0 right-0 z-50')
    expect(cliente).toContain('z-[60]')
    expect(cliente).toContain('bottom-[calc(4.25rem+env(safe-area-inset-bottom))]')
    expect(cliente).not.toContain('fixed inset-x-0 bottom-0 z-30')
  })

  it('guarda un borrador mientras se escribe y lo limpia al guardar', () => {
    expect(cliente).toContain('writeOnboardingDraft(organization.id')
    expect(cliente).toContain('isDraftWorthRestoring(draft, initialCompanyInfo, new Date())')
    expect(cliente).toContain('clearOnboardingDraft(organization.id)')
    expect(cliente).toContain('Retomamos lo que habías cargado')
  })

  it('publicar la tienda se confirma, como en Sitio Web', () => {
    expect(cliente).toContain('const publishingNow = form.storefrontPublic && !initialCompanyInfo.storefrontPublic')
    expect(cliente).toContain('&& (!publishingNow || confirmPublication)')
    expect(cliente).toContain('mi tienda queda visible para cualquiera con el enlace')
    expect(cliente).toContain('confirmCurrencyChange, confirmPublication')
  })
})

describe('el guardado del onboarding', () => {
  const ruta = leer('src/app/api/onboarding/complete/route.ts')

  it('el servidor también exige la confirmación al publicar', () => {
    expect(ruta).toContain("code: 'PUBLICATION_CONFIRMATION_REQUIRED'")
    expect(ruta).toContain('input.storefrontPublic && !wasPublic && !input.confirmPublication')
  })

  it('si el guardado falla, la visibilidad vuelve a como estaba', () => {
    // Se aplica antes de la RPC, así que un fallo dejaba la tienda publicada a medias.
    expect(ruta).toContain('Failed to revert storefront publication after onboarding error')
    expect(ruta).toContain("storefront_public: currentPublication?.storefront_public ?? false")
    expect(ruta).toContain('No se pudo finalizar el onboarding. No se guardó nada.')
  })

  it('no deja la organización sin módulos cuando el plan no habilita los sugeridos', () => {
    // Una lista vacía significa «ninguno», no «todos».
    expect(ruta).toContain('const applySuggestedModules = !alreadyCompleted && suggestedModules.length > 0')
    expect(ruta).toContain('const enabledModules = applySuggestedModules ? suggestedModules : null')
  })

  it('la regla de módulos efectivos sigue siendo la que obliga a este cuidado', async () => {
    const { resolveEffectiveModules } = await import('@/lib/saas/effective-modules')
    const entitled = { entitledModules: ['inventory', 'pos'], trialModules: [] }
    expect(resolveEffectiveModules({ ...entitled, enabledModules: null })).toEqual(['inventory', 'pos'])
    expect(resolveEffectiveModules({ ...entitled, enabledModules: [] })).toEqual([])
  })
})
