import { describe, expect, it } from 'vitest'
import { applyQuickAction, planModuleDiff, summarizeSubscription } from '@/lib/superadmin/organization-quick-actions'

const now = new Date('2026-11-16T12:00:00')

describe('resumen de la suscripción', () => {
  it('suspendida se ve bloqueada', () => {
    expect(summarizeSubscription({ status: 'suspended', payment_status: 'unpaid' }, now)).toMatchObject({ tone: 'danger', blocked: true, paymentLine: 'Pago pendiente' })
  })
  it('activa con pago impago también se ve bloqueada (es lo que pasaba al reactivar a mano)', () => {
    expect(summarizeSubscription({ status: 'active', payment_status: 'unpaid', current_period_ends_at: null }, now).blocked).toBe(true)
  })
  it('en prueba muestra hasta cuándo y avisa si quedan pocos días', () => {
    const summary = summarizeSubscription({ status: 'trialing', trial_ends_at: '2026-11-18T12:00:00' }, now)
    expect(summary).toMatchObject({ tone: 'warn', headline: 'En prueba', blocked: false })
    expect(summary.dueLine).toMatch(/Prueba hasta el .*\(en 2 días\)/)
  })
  it('sin suscripción lo dice', () => {
    expect(summarizeSubscription(null, now).headline).toBe('Sin suscripción registrada')
  })
})

describe('atajos', () => {
  it('extender 30 días suma al vencimiento vigente', () => {
    expect(applyQuickAction('extend_30', { status: 'active', current_period_ends_at: '2026-12-01T12:00:00' }, now)).toEqual({ status: 'active', current_period_ends_at: '2026-12-31' })
  })
  it('extender 30 días cuenta desde hoy si ya venció', () => {
    expect(applyQuickAction('extend_30', { status: 'suspended', current_period_ends_at: '2026-10-01T12:00:00' }, now)).toEqual({ status: 'active', current_period_ends_at: '2026-12-16' })
  })
  it('reactivar 1 mes y prueba de 7 días', () => {
    expect(applyQuickAction('reactivate_month', null, now)).toEqual({ status: 'active', current_period_ends_at: '2026-12-16' })
    expect(applyQuickAction('trial_7', null, now)).toEqual({ status: 'trialing', trial_ends_at: '2026-11-23' })
  })
})

describe('funciones al cambiar de plan', () => {
  it('lista lo que gana y lo que pierde', () => {
    expect(planModuleDiff(['pos', 'inventory', 'repairs'], ['pos', 'inventory', 'finances'])).toEqual({ gained: ['finances'], lost: ['repairs'] })
  })
  it('sin datos de un plan no inventa diferencias', () => {
    expect(planModuleDiff(undefined, ['pos'])).toEqual({ gained: [], lost: [] })
  })
})
