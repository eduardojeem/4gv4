import { describe, expect, it } from 'vitest'
import {
  buildPlanFeatureRows,
  buildPlanLimitRows,
  selectActivePlans,
  type SubscriptionPlan,
} from './saas-plan-presentation'

const plans: SubscriptionPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'FREE',
    price: 0,
    is_active: true,
    limits: { users: '1', repairs: '20/mes' },
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

  it('builds included features from each active plan instead of a tier matrix', () => {
    const rows = buildPlanFeatureRows(selectActivePlans(plans))

    expect(rows.find((row) => row.label === 'Analytics avanzado')?.values)
      .toEqual({ free: false, pro: true })
    expect(rows.some((row) => row.label === 'Soporte prioritario')).toBe(false)
  })
})
