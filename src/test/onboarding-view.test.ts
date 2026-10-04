import { describe, expect, it } from 'vitest'
import { isServiceFocused, socialHandle, splitSuggestedModules, subscriptionSummary } from '@/lib/onboarding/onboarding-view'

describe('configuración inicial: suscripción', () => {
  it('una suscripción activa muestra la renovación, no el fin de la prueba', () => {
    const summary = subscriptionSummary({ plan: 'BASIC', status: 'active', trialEndsAt: '2026-01-01T00:00:00Z', currentPeriodEndsAt: '2026-11-10T00:00:00Z' })
    expect(summary.label).toBe('Suscripción activa')
    expect(summary.dateLabel).toMatch(/^Se renueva el /)
    expect(summary.dateLabel).toContain('2026')
  })

  it('no llama «prueba» a lo vencido, cancelado o impago', () => {
    expect(subscriptionSummary({ plan: 'PRO', status: 'past_due', trialEndsAt: null }).label).toBe('Pago pendiente')
    expect(subscriptionSummary({ plan: 'PRO', status: 'canceled', trialEndsAt: null }).tone).toBe('danger')
    expect(subscriptionSummary({ plan: 'PRO', status: 'suspended', trialEndsAt: null }).label).toBe('Suscripción vencida')
    expect(subscriptionSummary({ plan: 'FREE', status: 'trialing', trialEndsAt: '2026-10-20T00:00:00Z' }).dateLabel).toMatch(/^Prueba hasta el /)
    expect(subscriptionSummary(null).label).toBe('Plan gratuito')
  })
})

describe('configuración inicial: módulos sugeridos', () => {
  it('separa lo que el plan incluye de lo que no', () => {
    expect(splitSuggestedModules(['pos', 'credits', 'crm'], ['pos', 'crm'])).toEqual({ included: ['pos', 'crm'], notIncluded: ['credits'] })
    // Sin datos del plan, no se esconde nada.
    expect(splitSuggestedModules(['pos'], null)).toEqual({ included: ['pos'], notIncluded: [] })
  })

  it('reconoce los negocios de servicios', () => {
    expect(isServiceFocused('barbershop', 'retail')).toBe(true)
    expect(isServiceFocused('cosmetics', 'service')).toBe(true)
    expect(isServiceFocused('clothing', 'retail')).toBe(false)
  })
})

describe('configuración inicial: redes', () => {
  it('del enlace pegado o del @ queda solo el usuario', () => {
    expect(socialHandle('https://www.instagram.com/mitienda/', 'instagram')).toBe('mitienda')
    expect(socialHandle('@mitienda', 'instagram')).toBe('mitienda')
    expect(socialHandle('https://www.tiktok.com/@mitienda?lang=es', 'tiktok')).toBe('mitienda')
    expect(socialHandle('https://m.facebook.com/MiTienda/', 'facebook')).toBe('MiTienda')
    // Los perfiles de Facebook sin nombre conservan el id.
    expect(socialHandle('https://facebook.com/profile.php?id=123', 'facebook')).toBe('profile.php?id=123')
    expect(socialHandle('  mitienda ', 'instagram')).toBe('mitienda')
  })
})
