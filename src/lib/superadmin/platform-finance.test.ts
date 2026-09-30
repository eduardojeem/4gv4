import { describe, expect, it } from 'vitest'
import {
  computeMrr,
  expenseInputSchema,
  monthlyRecurringPyg,
  oneTimeInMonthPyg,
  summarizePlatformFinance,
  todayInParaguay,
  type PlatformExpense,
} from './platform-finance'

const gasto = (extra: Partial<PlatformExpense> = {}): PlatformExpense => ({
  id: 'g1',
  provider: 'Vercel',
  category: 'infraestructura',
  description: null,
  amount: 20,
  currency: 'USD',
  fxRatePyg: 7500,
  recurrence: 'monthly',
  startsOn: '2026-01-01',
  endsOn: null,
  isActive: true,
  ...extra,
})

const HOY = '2026-09-15'

describe('costo mensual de un gasto', () => {
  it('convierte USD con el tipo de cambio guardado en el gasto', () => {
    expect(monthlyRecurringPyg(gasto(), HOY)).toBe(150_000)
  })

  it('reparte un gasto anual en 12 meses', () => {
    expect(monthlyRecurringPyg(gasto({ recurrence: 'yearly', amount: 120, currency: 'PYG', fxRatePyg: 1 }), HOY)).toBe(10)
  })

  it('no cuenta gastos pausados, que todavía no empezaron o que ya terminaron', () => {
    expect(monthlyRecurringPyg(gasto({ isActive: false }), HOY)).toBe(0)
    expect(monthlyRecurringPyg(gasto({ startsOn: '2026-10-01' }), HOY)).toBe(0)
    expect(monthlyRecurringPyg(gasto({ endsOn: '2026-08-31' }), HOY)).toBe(0)
  })

  it('un gasto único no es recurrente y solo pesa en su mes', () => {
    const unico = gasto({ recurrence: 'one_time', startsOn: '2026-09-02' })
    expect(monthlyRecurringPyg(unico, HOY)).toBe(0)
    expect(oneTimeInMonthPyg(unico, HOY)).toBe(150_000)
    expect(oneTimeInMonthPyg(unico, '2026-10-01')).toBe(0)
  })
})

describe('MRR', () => {
  it('suma solo suscripciones activas y distingue las que pagan', () => {
    const result = computeMrr(
      [{ tier: 'free', price: 0 }, { tier: 'pro', price: 200_000 }],
      [
        { plan: 'pro', status: 'active' },
        { plan: 'PRO', status: 'active' },
        { plan: 'free', status: 'active' },
        { plan: 'pro', status: 'trialing' },
        { plan: 'pro', status: 'canceled' },
      ],
    )
    expect(result).toEqual({ mrr: 400_000, activeOrgs: 3, payingOrgs: 2, unpricedOrgs: 0 })
  })

  it('usa la regla única: alias, planes retirados, cobros fallidos y planes sin precio', () => {
    const result = computeMrr(
      [{ tier: 'basic', price: 100_000 }, { tier: 'legacy', price: 90_000 }],
      [
        { plan: 'starter', status: 'active' },
        { plan: 'legacy', status: 'active' },
        { plan: 'basic', status: 'active', paymentStatus: 'failed' },
        { plan: 'enterprise', status: 'active' },
      ],
    )
    expect(result).toEqual({ mrr: 190_000, activeOrgs: 4, payingOrgs: 2, unpricedOrgs: 1 })
  })
})

describe('resumen de rentabilidad', () => {
  const gastos = [
    gasto({ id: 'a', provider: 'Vercel', amount: 20 }),
    gasto({ id: 'b', provider: 'Supabase', amount: 25 }),
    gasto({ id: 'c', provider: 'Dominio', category: 'herramientas', currency: 'PYG', fxRatePyg: 1, amount: 120_000, recurrence: 'yearly' }),
    gasto({ id: 'd', provider: 'Diseño logo', category: 'marketing', currency: 'PYG', fxRatePyg: 1, amount: 300_000, recurrence: 'one_time', startsOn: '2026-09-10' }),
  ]

  it('resta el costo recurrente al MRR y aparte los gastos únicos del mes', () => {
    const summary = summarizePlatformFinance(gastos, { mrr: 1_000_000, payingOrgs: 5 }, HOY)
    expect(summary.recurringMonthlyCost).toBe(150_000 + 187_500 + 10_000)
    expect(summary.oneTimeThisMonth).toBe(300_000)
    expect(summary.netMonthly).toBe(1_000_000 - 347_500)
    expect(summary.netThisMonth).toBe(1_000_000 - 347_500 - 300_000)
    expect(summary.marginPercent).toBe(65.3)
  })

  it('calcula costo por tienda y cuántas tiendas cubren los costos', () => {
    const summary = summarizePlatformFinance(gastos, { mrr: 1_000_000, payingOrgs: 5 }, HOY)
    expect(summary.revenuePerPayingOrg).toBe(200_000)
    expect(summary.costPerPayingOrg).toBe(69_500)
    expect(summary.breakEvenOrgs).toBe(2)
  })

  it('agrupa por categoría y por proveedor, del más caro al más barato', () => {
    const summary = summarizePlatformFinance(gastos, { mrr: 1_000_000, payingOrgs: 5 }, HOY)
    expect(summary.byCategory.map((row) => row.category)).toEqual(['infraestructura', 'herramientas'])
    expect(summary.byProvider[0]).toMatchObject({ provider: 'Supabase', monthly: 187_500 })
  })

  it('sin ingresos no inventa margen ni punto de equilibrio', () => {
    const summary = summarizePlatformFinance(gastos, { mrr: 0, payingOrgs: 0 }, HOY)
    expect(summary.marginPercent).toBeNull()
    expect(summary.breakEvenOrgs).toBeNull()
    expect(summary.costPerPayingOrg).toBeNull()
  })
})

describe('validación de un gasto', () => {
  const base = {
    provider: ' Vercel ',
    category: 'infraestructura',
    description: '',
    amount: 20,
    currency: 'USD',
    fxRatePyg: 7500,
    recurrence: 'monthly',
    startsOn: '2026-09-01',
    endsOn: null,
    isActive: true,
  }

  it('normaliza proveedor, descripción vacía y fuerza tipo de cambio 1 en guaraníes', () => {
    const parsed = expenseInputSchema.parse({ ...base, currency: 'PYG', fxRatePyg: 9999 })
    expect(parsed.provider).toBe('Vercel')
    expect(parsed.description).toBeNull()
    expect(parsed.fxRatePyg).toBe(1)
  })

  it('rechaza montos negativos, categorías desconocidas y fin antes del inicio', () => {
    expect(expenseInputSchema.safeParse({ ...base, amount: -1 }).success).toBe(false)
    expect(expenseInputSchema.safeParse({ ...base, category: 'viajes' }).success).toBe(false)
    expect(expenseInputSchema.safeParse({ ...base, endsOn: '2026-08-01' }).success).toBe(false)
  })
})

describe('fecha de referencia', () => {
  it('usa el día de Paraguay aunque el servidor esté en UTC', () => {
    expect(todayInParaguay(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09-30')
  })
})
