import { describe, expect, it } from 'vitest'
import {
  getUnrepairedCloseoutPreview,
  parseUnrepairedCloseoutRequest,
} from './unrepaired-closeout'

const partId = '6d8238d2-fdc5-4939-85d7-130a823982b0'

describe('unrepaired repair closeout contract', () => {
  it('accepts a no-charge withdrawal with an explicit part resolution', () => {
    const result = parseUnrepairedCloseoutRequest({
      outcome: 'withdrawn',
      charge: { mode: 'none' },
      parts: [{ repairPartId: partId, disposition: 'restocked' }],
      settlement: { kind: 'store_credit' },
      idempotencyKey: 'repair-closeout-123',
    })

    expect(result.success).toBe(true)
  })

  it('requires a reason and amount for an exceptional charge', () => {
    expect(parseUnrepairedCloseoutRequest({
      outcome: 'unrepairable',
      charge: { mode: 'exceptional', amount: 50_000 },
      parts: [],
      settlement: { kind: 'outstanding' },
      idempotencyKey: 'repair-closeout-456',
    }).success).toBe(false)

    expect(parseUnrepairedCloseoutRequest({
      outcome: 'unrepairable',
      charge: { mode: 'exceptional', amount: 50_000 },
      parts: [],
      settlement: { kind: 'outstanding' },
      reason: 'Importe acordado con el cliente',
      idempotencyKey: 'repair-closeout-456',
    }).success).toBe(true)
  })

  it('rejects duplicate part resolutions and server-controlled totals', () => {
    expect(parseUnrepairedCloseoutRequest({
      outcome: 'withdrawn',
      charge: { mode: 'none' },
      parts: [
        { repairPartId: partId, disposition: 'restocked' },
        { repairPartId: partId, disposition: 'consumed' },
      ],
      settlement: { kind: 'none' },
      finalCharge: 0,
      idempotencyKey: 'repair-closeout-789',
    }).success).toBe(false)
  })

  it('requires a transfer reference for payments and refunds', () => {
    for (const settlement of [
      { kind: 'payment', method: 'transfer', amount: 10_000 },
      { kind: 'refund', method: 'transfer' },
    ]) {
      expect(parseUnrepairedCloseoutRequest({
        outcome: 'withdrawn',
        charge: { mode: 'labor', laborAmount: 10_000 },
        parts: [],
        settlement,
        idempotencyKey: 'repair-closeout-transfer',
      }).success).toBe(false)
    }
  })

  it('derives a presentation preview without hiding an overpayment', () => {
    expect(getUnrepairedCloseoutPreview({
      chargeMode: 'labor_and_consumed_parts',
      laborAmount: 30_000,
      exceptionalAmount: 0,
      paidAmount: 100_000,
      parts: [
        { disposition: 'consumed', quantity: 2, unitPrice: 20_000 },
        { disposition: 'restocked', quantity: 1, unitPrice: 50_000 },
      ],
    })).toEqual({
      laborCharge: 30_000,
      consumedPartsCharge: 40_000,
      finalCharge: 70_000,
      paidAmount: 100_000,
      difference: -30_000,
    })
  })
})
