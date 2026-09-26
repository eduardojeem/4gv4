import { describe, expect, it } from 'vitest'

import { computePlanStats } from './plan-stats'

describe('computePlanStats', () => {
  const plans = [
    { tier: 'free', price: 0 },
    { tier: 'basic', price: 150_000 },
    { tier: 'pro', price: 350_000 },
  ]

  it('suma al MRR solo las suscripciones activas', () => {
    const stats = computePlanStats(plans, [
      { plan: 'basic', status: 'active' },
      { plan: 'pro', status: 'active' },
      { plan: 'pro', status: 'trialing' },
      { plan: 'basic', status: 'canceled' },
    ])

    expect(stats.mrr).toBe(500_000)
    expect(stats.activeSubs).toBe(2)
    expect(stats.trialingSubs).toBe(1)
  })

  it('cuenta la facturacion de un plan retirado que aun tiene clientes', () => {
    // Es el bug que motivo el cambio: se leian solo los planes activos, asi que
    // un plan que se dejo de vender pero se sigue cobrando aportaba 0 y el MRR
    // mostraba menos ingresos de los reales.
    const stats = computePlanStats(
      [...plans, { tier: 'legacy', price: 90_000 }],
      [
        { plan: 'basic', status: 'active' },
        { plan: 'legacy', status: 'active' },
      ],
    )

    expect(stats.mrr).toBe(240_000)
  })

  it('un plan desconocido no rompe el calculo', () => {
    const stats = computePlanStats(plans, [{ plan: 'inexistente', status: 'active' }])

    expect(stats.mrr).toBe(0)
    expect(stats.activeSubs).toBe(1)
  })

  it('trata la suscripcion sin plan como FREE', () => {
    const stats = computePlanStats(plans, [{ plan: null, status: 'active' }])

    expect(stats.orgsByPlan.FREE).toBe(1)
    expect(stats.mrr).toBe(0)
  })

  it('cuenta todas las organizaciones, activas o no', () => {
    const stats = computePlanStats(plans, [
      { plan: 'basic', status: 'active' },
      { plan: 'basic', status: 'canceled' },
      { plan: 'pro', status: 'trialing' },
    ])

    expect(stats.totalOrgs).toBe(3)
    expect(stats.orgsByPlan.BASIC).toBe(2)
    expect(stats.activeByPlan.BASIC).toBe(1)
  })

  it('identifica el plan mas usado con su porcentaje', () => {
    const stats = computePlanStats(plans, [
      { plan: 'basic', status: 'active' },
      { plan: 'basic', status: 'active' },
      { plan: 'basic', status: 'canceled' },
      { plan: 'pro', status: 'active' },
    ])

    expect(stats.mostUsedPlan).toBe('BASIC')
    expect(stats.mostUsedPercent).toBe(75)
  })

  it('no divide por cero cuando no hay suscripciones', () => {
    const stats = computePlanStats(plans, [])

    expect(stats.totalOrgs).toBe(0)
    expect(stats.mostUsedPercent).toBe(0)
    expect(stats.mostUsedPlan).toBeNull()
    expect(stats.mrr).toBe(0)
  })

  it('acepta precios que vienen como texto desde la base', () => {
    const stats = computePlanStats(
      [{ tier: 'basic', price: '150000' }],
      [{ plan: 'basic', status: 'active' }],
    )

    expect(stats.mrr).toBe(150_000)
  })
})
