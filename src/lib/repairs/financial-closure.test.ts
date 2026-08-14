import { describe, expect, it } from 'vitest'
import {
  getRepairPaymentSummary,
  parseRepairDeliveryRequest,
  parseRepairPaymentRequest,
} from './financial-closure'

describe('repair financial closure contracts', () => {
  it('requires explicit outstanding-balance consent when delivering without payment', () => {
    expect(parseRepairDeliveryRequest({ outcome: 'repaired' }).success).toBe(false)
    expect(parseRepairDeliveryRequest({
      outcome: 'repaired',
      allowOutstandingBalance: true,
      idempotencyKey: 'delivery-123',
    }).success).toBe(true)
  })

  it('accepts a validated payment request and rejects server-controlled fields', () => {
    expect(parseRepairPaymentRequest({
      method: 'cash',
      amount: 50_000,
      idempotencyKey: 'payment-123',
    }).success).toBe(true)

    expect(parseRepairPaymentRequest({
      method: 'cash',
      amount: 50_000,
      idempotencyKey: 'payment-123',
      paid_amount: 50_000,
    }).success).toBe(false)
  })

  it('derives a partial financial state independently from delivery', () => {
    expect(getRepairPaymentSummary({
      finalCost: 100_000,
      estimatedCost: 80_000,
      paidAmount: 40_000,
    })).toEqual({
      total: 100_000,
      paid: 40_000,
      balance: 60_000,
      status: 'parcial',
    })
  })

  it('clamps invalid aggregates without hiding an overpaid persisted row', () => {
    expect(getRepairPaymentSummary({
      finalCost: 100_000,
      estimatedCost: 0,
      paidAmount: 120_000,
    })).toEqual({
      total: 100_000,
      paid: 120_000,
      balance: 0,
      status: 'pagado',
    })
  })
})
