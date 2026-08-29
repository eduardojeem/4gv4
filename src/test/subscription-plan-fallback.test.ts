import { describe, expect, it } from 'vitest'

import { buildFallbackPlan, DEFAULT_LIMITS } from '@/lib/saas/subscription-service'

/**
 * Cuando la tabla `plans` no tiene la fila del plan de la organizacion, el
 * servicio arma uno de respaldo. Antes ese respaldo copiaba los limites de Free
 * conservando el codigo real: la pantalla decia "Plan BASIC" y el sistema
 * aplicaba 50 productos, sin nada que lo delatara.
 */
describe('buildFallbackPlan', () => {
  it('keeps the limits of the plan the organization actually has', () => {
    const plan = buildFallbackPlan('BASIC')

    expect(plan.code).toBe('BASIC')
    expect(plan.limits.products).toBe(DEFAULT_LIMITS.BASIC.products)
    // El bug: 50 es el cupo de Free.
    expect(plan.limits.products).not.toBe(DEFAULT_LIMITS.FREE.products)
  })

  it('marks the plan so the interface can warn that limits are a fallback', () => {
    expect(buildFallbackPlan('BASIC').limits_are_fallback).toBe(true)
  })

  it('resolves each known plan to its own limits', () => {
    expect(buildFallbackPlan('FREE').limits.products).toBe(50)
    expect(buildFallbackPlan('BASIC').limits.products).toBe(500)
    expect(buildFallbackPlan('PRO').limits.products).toBe(5000)
    expect(buildFallbackPlan('ENTERPRISE').limits.products).toBeNull()
  })

  it('keeps operational module entitlements when the plan row is temporarily unavailable', () => {
    expect(buildFallbackPlan('FREE').modules).toContain('services')
    expect(buildFallbackPlan('FREE').modules).not.toContain('orders')
    expect(buildFallbackPlan('BASIC').modules).toEqual(expect.arrayContaining(['services', 'orders', 'delivery']))
    expect(buildFallbackPlan('PRO').modules).toEqual(expect.arrayContaining(['services', 'orders', 'delivery']))
  })

  it('accepts the aliases the app uses for plan codes', () => {
    expect(buildFallbackPlan('basic').limits.products).toBe(500)
    expect(buildFallbackPlan('starter').limits.products).toBe(500)
    expect(buildFallbackPlan('profesional').limits.products).toBe(5000)
  })

  it('falls back to the free limits for an unknown plan code', () => {
    expect(buildFallbackPlan('PLAN_INVENTADO').limits.products).toBe(DEFAULT_LIMITS.FREE.products)
  })
})
