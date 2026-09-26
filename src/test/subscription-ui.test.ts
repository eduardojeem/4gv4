import { describe, expect, it } from 'vitest'
import type { OrganizationUsage, PlanRecord } from '@/lib/saas/subscription-service'
import {
  averageUsagePercent,
  daysUntil,
  quotaTone,
  quotasNeedingAttention,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  usagePercent,
} from '@/lib/saas/subscription-ui'

const plan = (limits: PlanRecord['limits']): PlanRecord => ({
  code: 'PRO',
  slug: 'pro',
  name: 'Plan Pro',
  price_monthly: 150000,
  price_note: null,
  currency: 'PYG',
  limits,
  features: {},
  modules: [],
  is_active: true,
})

const uso = (parcial: Partial<OrganizationUsage>): OrganizationUsage => ({
  users: 0,
  branches: 0,
  cashRegisters: 0,
  products: 0,
  categories: 0,
  repairs: 0,
  services: 0,
  ...parcial,
})

describe('cuanto se uso de un cupo', () => {
  it('sin tope no es 0% ni 100%: no es un porcentaje', () => {
    expect(usagePercent(120, null)).toBeNull()
    expect(quotaTone(null)).toBe('ok')
  })

  it('redondea y no pasa de 100', () => {
    expect(usagePercent(1, 3)).toBe(33)
    expect(usagePercent(150, 1000)).toBe(15)
    expect(usagePercent(12, 10)).toBe(100)
  })

  /**
   * Un cupo en cero con algo cargado daba 0%, y la tarjeta mostraba
   * «Disponible» al lado de «0 libres».
   */
  it('un tope en cero con algo cargado esta lleno, no vacio', () => {
    expect(usagePercent(3, 0)).toBe(100)
    expect(quotaTone(usagePercent(3, 0))).toBe('danger')
    expect(usagePercent(0, 0)).toBe(0)
  })

  it('el color avisa recien al 80 y grita al 100', () => {
    expect(quotaTone(79)).toBe('neutral')
    expect(quotaTone(80)).toBe('warn')
    expect(quotaTone(99)).toBe('warn')
    expect(quotaTone(100)).toBe('danger')
  })
})

describe('el promedio de cupos', () => {
  /**
   * El encabezado y el desglose tenian cada uno su propia lista de recursos.
   * Con una sola, el numero de arriba y las tarjetas de abajo cuentan lo mismo.
   */
  it('promedia solo los cupos con tope', () => {
    const p = plan({ users: 10, branches: 2, cashRegisters: null, products: 100, categories: null })
    // 50% + 50% + 50% = 50
    expect(averageUsagePercent(p, uso({ users: 5, branches: 1, products: 50, cashRegisters: 99 }))).toBe(50)
  })

  it('sin ningun tope el promedio es cero, no NaN', () => {
    const p = plan({ users: null, branches: null, cashRegisters: null, products: null, categories: null })
    expect(averageUsagePercent(p, uso({ users: 30, products: 900 }))).toBe(0)
  })

  it('cuenta los cupos que pasaron el 80%', () => {
    const p = plan({ users: 10, branches: 2, cashRegisters: 4, products: 100, categories: null })
    const actual = uso({ users: 9, branches: 2, cashRegisters: 1, products: 10 })
    // usuarios 90% y sucursales 100%; cajas 25% y productos 10% no cuentan.
    expect(quotasNeedingAttention(p, actual)).toBe(2)
  })
})

describe('los dias que faltan', () => {
  const ahora = new Date('2026-09-13T12:00:00.000Z').getTime()

  it('cuenta hacia adelante y hacia atras', () => {
    expect(daysUntil('2026-09-20T12:00:00.000Z', ahora)).toBe(7)
    expect(daysUntil('2026-09-13T12:00:00.000Z', ahora)).toBe(0)
    expect(daysUntil('2026-09-10T12:00:00.000Z', ahora)).toBe(-3)
  })

  it('sin fecha, o con basura, no inventa un numero', () => {
    expect(daysUntil(null, ahora)).toBeNull()
    expect(daysUntil('', ahora)).toBeNull()
    expect(daysUntil('no es una fecha', ahora)).toBeNull()
  })
})

describe('el estado de la suscripcion', () => {
  it('traduce lo conocido y deja pasar lo que no', () => {
    expect(subscriptionStatusLabel('past_due')).toBe('Pago vencido')
    expect(subscriptionStatusLabel(null)).toBe('Sin estado')
    expect(subscriptionStatusLabel('algo_nuevo')).toBe('algo_nuevo')
  })

  it('un pago fallido no puede verse igual que uno al dia', () => {
    expect(subscriptionStatusTone('paid')).toBe('ok')
    expect(subscriptionStatusTone('failed')).toBe('danger')
    expect(subscriptionStatusTone('pending')).toBe('warn')
    expect(subscriptionStatusTone('trialing')).toBe('info')
  })
})
