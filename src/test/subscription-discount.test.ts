import { afterEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => supabase }))

const { applySubscriptionDiscount, findAvailableSubscriptionDiscount } = await import('@/lib/saas/subscription-discount')

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'update']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

const NOW = new Date('2026-11-01T12:00:00Z').getTime()

afterEach(() => {
  supabase.from.mockReset()
})

describe('applySubscriptionDiscount', () => {
  it('aplica porcentaje y monto fijo, sin bajar de 1 guaraní', () => {
    expect(applySubscriptionDiscount(200000, { redemptionId: 'r', percent: 20, amount: null })).toBe(160000)
    expect(applySubscriptionDiscount(200000, { redemptionId: 'r', percent: null, amount: 50000 })).toBe(150000)
    expect(applySubscriptionDiscount(200000, { redemptionId: 'r', percent: null, amount: 500000 })).toBe(1)
    expect(applySubscriptionDiscount(200000, null)).toBe(200000)
  })
})

describe('findAvailableSubscriptionDiscount', () => {
  it('toma el cupón de descuento libre y respeta el plan del cupón', async () => {
    supabase.from.mockReturnValueOnce(query({
      data: [
        { id: 'trial', benefit_snapshot: { benefit_type: 'extend_trial' }, applied_payment_id: null },
        { id: 'otro-plan', benefit_snapshot: { benefit_type: 'discount_percent', discount_percent: 50, target_plan: 'pro' }, applied_payment_id: null },
        { id: 'libre', benefit_snapshot: { benefit_type: 'discount_percent', discount_percent: 20 }, applied_payment_id: null },
      ],
      error: null,
    }))

    await expect(findAvailableSubscriptionDiscount('org', 'BASIC', NOW)).resolves.toEqual({ redemptionId: 'libre', percent: 20, amount: null })
  })

  it('no reutiliza un cupón ya usado en un pago cobrado, pero sí uno cuyo pago falló', async () => {
    supabase.from
      .mockReturnValueOnce(query({
        data: [
          { id: 'usado', benefit_snapshot: { benefit_type: 'discount_fixed', discount_amount: 10000 }, applied_payment_id: 'pago-ok' },
          { id: 'fallido', benefit_snapshot: { benefit_type: 'discount_fixed', discount_amount: 20000 }, applied_payment_id: 'pago-fallido' },
        ],
        error: null,
      }))
      .mockReturnValueOnce(query({ data: { status: 'paid', created_at: '2026-10-31T12:00:00Z' } }))
      .mockReturnValueOnce(query({ data: { status: 'failed', created_at: '2026-10-31T12:00:00Z' } }))

    await expect(findAvailableSubscriptionDiscount('org', 'BASIC', NOW)).resolves.toEqual({ redemptionId: 'fallido', percent: null, amount: 20000 })
  })

  it('libera el cupón de un pago que quedó pendiente más de 72 horas', async () => {
    supabase.from
      .mockReturnValueOnce(query({
        data: [{ id: 'viejo', benefit_snapshot: { benefit_type: 'discount_percent', discount_percent: 10 }, applied_payment_id: 'pendiente' }],
        error: null,
      }))
      .mockReturnValueOnce(query({ data: { status: 'pending', created_at: '2026-10-28T12:00:00Z' } }))

    await expect(findAvailableSubscriptionDiscount('org', 'BASIC', NOW)).resolves.toMatchObject({ redemptionId: 'viejo' })
  })
})
