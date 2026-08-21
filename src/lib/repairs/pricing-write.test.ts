import { describe, expect, it } from 'vitest'
import { RepairPricingWriteError, resolveRepairPricingWrite } from './pricing-write'

const parts = [{ unit_price: 100, unit_cost: 60, quantity: 2 }]

describe('resolveRepairPricingWrite', () => {
  it('ignores a forged final total in automatic mode', () => {
    const result = resolveRepairPricingWrite({
      mode: 'automatic',
      currency: 'USD',
      laborCost: 50,
      finalCost: 1,
      discountAmount: 20,
      paidAmount: 0,
      parts,
      role: 'tecnico',
      overrideReason: 'Descuento de mostrador autorizado',
    })

    expect(result.finalCost).toBe(230)
    expect(result.laborCost).toBe(50)
  })

  it('derives labor from the agreed budget', () => {
    const result = resolveRepairPricingWrite({
      mode: 'budget',
      currency: 'USD',
      laborCost: 1,
      finalCost: 300,
      discountAmount: 10,
      paidAmount: 0,
      parts,
      role: 'tecnico',
      overrideReason: 'Presupuesto acordado con el cliente',
    })

    expect(result.laborCost).toBe(110)
    expect(result.finalCost).toBe(300)
  })

  it('restricts manual pricing to administrators', () => {
    expect(() => resolveRepairPricingWrite({
      mode: 'manual',
      currency: 'USD',
      laborCost: 0,
      finalCost: 150,
      discountAmount: 0,
      paidAmount: 0,
      parts,
      role: 'tecnico',
    })).toThrowError(RepairPricingWriteError)
  })

  it('requires a reason for an administrative total below regular parts price', () => {
    expect(() => resolveRepairPricingWrite({
      mode: 'manual',
      currency: 'USD',
      laborCost: 0,
      finalCost: 150,
      discountAmount: 0,
      paidAmount: 0,
      parts,
      role: 'admin',
      overrideReason: '',
    })).toThrowError(/motivo/i)
  })

  it('never allows the total to fall below an amount already paid', () => {
    expect(() => resolveRepairPricingWrite({
      mode: 'manual',
      currency: 'USD',
      laborCost: 100,
      finalCost: 90,
      discountAmount: 0,
      paidAmount: 100,
      parts: [],
      role: 'admin',
      overrideReason: 'Correccion administrativa documentada',
    })).toThrowError(/pagado/i)
  })

  it('requires a reason for every discount', () => {
    expect(() => resolveRepairPricingWrite({
      mode: 'automatic',
      currency: 'USD',
      laborCost: 100,
      finalCost: null,
      discountAmount: 10,
      paidAmount: 0,
      parts: [],
      role: 'tecnico',
    })).toThrowError(/motivo del descuento/i)
  })

  it('blocks non-admin pricing below verified internal cost', () => {
    expect(() => resolveRepairPricingWrite({
      mode: 'automatic',
      currency: 'USD',
      laborCost: 0,
      finalCost: null,
      discountAmount: 50,
      paidAmount: 0,
      parts: [{ unit_price: 100, unit_cost: 80, quantity: 1 }],
      role: 'tecnico',
      overrideReason: 'Descuento comercial documentado',
    })).toThrowError(/autorizacion administrativa/i)
  })

  it('preserves classified service and included-material totals', () => {
    const result = resolveRepairPricingWrite({
      mode: 'automatic',
      currency: 'PYG',
      laborCost: 0,
      finalCost: null,
      discountAmount: 0,
      paidAmount: 0,
      parts: [
        { line_type: 'service', unit_price: 250_000, unit_cost: 0, quantity: 1 },
        { line_type: 'included_material', unit_price: 0, unit_cost: 100_000, quantity: 1 },
      ],
      role: 'tecnico',
    })

    expect(result.servicesSubtotal).toBe(250_000)
    expect(result.chargedPartsSubtotal).toBe(0)
    expect(result.finalCost).toBe(250_000)
    expect(result.margin).toBe(150_000)
  })
})
