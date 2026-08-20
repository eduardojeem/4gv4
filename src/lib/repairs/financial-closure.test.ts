import { describe, expect, it } from 'vitest'
import {
  getRepairFinancialPresentation,
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

  it.each(['card', 'transfer'] as const)(
    'requires an auditable reference for %s payments',
    (method) => {
      expect(parseRepairPaymentRequest({
        method,
        amount: 50_000,
        idempotencyKey: `payment-${method}`,
      }).success).toBe(false)

      expect(parseRepairPaymentRequest({
        method,
        amount: 50_000,
        reference: 'COMPROBANTE-123',
        idempotencyKey: `payment-${method}`,
      }).success).toBe(true)
    },
  )

  it.each(['cash', 'credit'] as const)(
    'does not require an external reference for %s payments',
    (method) => {
      expect(parseRepairPaymentRequest({
        method,
        amount: 50_000,
        idempotencyKey: `payment-${method}`,
      }).success).toBe(true)
    },
  )

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

  it('keeps an advance as partial while the repair price is still unknown', () => {
    expect(getRepairPaymentSummary({
      finalCost: null,
      estimatedCost: 0,
      paidAmount: 40_000,
    })).toEqual({
      total: null,
      paid: 40_000,
      balance: null,
      status: 'parcial',
      priceDefined: false,
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

  it('keeps delivered and payment state independent in presentation', () => {
    expect(getRepairFinancialPresentation({
      status: 'entregado', finalCost: 100_000, estimatedCost: 80_000, paidAmount: 40_000,
    })).toMatchObject({ label: 'Entregado · pago parcial', canCollect: true, balance: 60_000 })

    expect(getRepairFinancialPresentation({
      status: 'entregado', finalCost: 100_000, estimatedCost: 80_000, paidAmount: 100_000,
    })).toMatchObject({ label: 'Entregado · pagado', canCollect: false, balance: 0 })
  })
})
