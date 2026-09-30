import { describe, expect, it } from 'vitest'
import {
  buildPlanFeatureGroups,
  buildPlanFeatureRows,
  buildPlanLimitRows,
  publicLimitText,
  selectActivePlans,
  type SubscriptionPlan,
} from './saas-plan-presentation'
import { PLAN_FEATURES } from '@/lib/saas/plan-feature-catalog'

const plans: SubscriptionPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'FREE',
    price: 0,
    is_active: true,
    limits: { users: '1', repairs: '20/mes', repairPhotos: '0' },
    features: [
      { label: 'Inventario', value: true },
      { label: 'Analytics avanzado', value: false },
    ],
  },
  {
    id: 'pro',
    tier: 'pro',
    name: 'PRO',
    price: 150_000,
    is_active: true,
    limits: { users: '10', repairs: 'Ilimitadas' },
    features: [
      { label: 'Inventario', value: true },
      { label: 'Analytics avanzado', value: true },
    ],
  },
  {
    id: 'enterprise',
    tier: 'enterprise',
    name: 'ENTERPRISE',
    price: 300_000,
    is_active: false,
    limits: { users: 'Ilimitados' },
    features: [{ label: 'Soporte prioritario', value: true }],
  },
]

describe('public SaaS plan presentation', () => {
  it('never returns inactive plans and does not replace an empty database result with defaults', () => {
    expect(selectActivePlans(plans).map((plan) => plan.name)).toEqual(['FREE', 'PRO'])
    expect(selectActivePlans([])).toEqual([])
  })

  it('builds comparison limits from the active database rows', () => {
    const active = selectActivePlans(plans)
    const rows = buildPlanLimitRows(active)

    expect(rows.find((row) => row.key === 'users')?.values).toEqual({ free: '1', pro: '10' })
    expect(rows.find((row) => row.key === 'repairs')?.values).toEqual({ free: '20/mes', pro: 'Ilimitadas' })
    expect(rows.every((row) => !('enterprise' in row.values))).toBe(true)
  })

  it('usa los nombres y el formato del panel, y un 0 dice «No incluye»', () => {
    const rows = buildPlanLimitRows(selectActivePlans(plans))
    expect(rows.map((row) => row.label)).toEqual(['Usuarios', 'Reparaciones por mes', 'Fotos por reparación'])
    expect(rows.find((row) => row.key === 'repairPhotos')?.values).toEqual({ free: 'No incluye', pro: 'No especificado' })
    expect(publicLimitText('products', '10000')).toBe('10.000')
  })

  it('builds included features from each active plan instead of a tier matrix', () => {
    const rows = buildPlanFeatureRows(selectActivePlans(plans))

    expect(rows.find((row) => row.label === 'Analytics avanzado')?.values)
      .toEqual({ free: false, pro: true })
    // Soporte solo lo marca el plan inactivo: se lista, pero ningún activo lo tiene.
    expect(rows.find((row) => row.label === 'Soporte prioritario')?.values).toEqual({ free: false, pro: false })
  })

  it('lista todas las funciones del catálogo, agrupadas, según lo que da cada plan', () => {
    const groups = buildPlanFeatureGroups(selectActivePlans(plans))
    expect(groups.flatMap((group) => group.rows).map((row) => row.key)).toEqual(
      ['venta', 'operacion', 'gestion', 'servicio'].flatMap((group) =>
        PLAN_FEATURES.filter((feature) => feature.group === group).map((feature) => feature.key)),
    )
    const row = (key: string) => groups.flatMap((group) => group.rows).find((item) => item.key === key)
    // El plan pro trae Visitas web y Finanzas por defecto aunque su lista no las nombre.
    expect(row('webAnalytics')?.values).toEqual({ free: false, pro: true })
    expect(row('finances')?.values).toEqual({ free: false, pro: true })
    expect(row('webAnalytics')?.hint).toMatch(/tienda online/)
  })
})
