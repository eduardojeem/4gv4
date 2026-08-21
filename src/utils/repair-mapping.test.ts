import { describe, expect, it } from 'vitest'
import { mapSupabaseRepairToUi } from './repair-mapping'

describe('repair UI mapping', () => {
  it('maps and sorts immutable payment history newest first', () => {
    const repair = mapSupabaseRepairToUi({
      id: 'repair-1', device_brand: 'Apple', device_model: 'iPhone',
      problem_description: 'Pantalla', status: 'entregado',
      created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-14T00:00:00Z',
      payments: [
        { id: 'p1', amount: 20_000, payment_method: 'cash', source: 'delivery', created_at: '2026-08-13T10:00:00Z' },
        { id: 'p2', amount: 30_000, payment_method: 'transfer', source: 'repairs', reference: 'TRX-1', created_at: '2026-08-14T10:00:00Z' },
      ],
    })

    expect(repair.payments).toEqual([
      expect.objectContaining({ id: 'p2', amount: 30_000, method: 'transfer', reference: 'TRX-1' }),
      expect.objectContaining({ id: 'p1', amount: 20_000, method: 'cash' }),
    ])
  })

  it('keeps repair part UUIDs and maps the unrepaired financial closeout', () => {
    const repair = mapSupabaseRepairToUi({
      id: 'repair-1', device_brand: 'Apple', device_model: 'iPhone', problem_description: 'Pantalla',
      status: 'entregado', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-15T00:00:00Z',
      parts: [{ id: '6d8238d2-fdc5-4939-85d7-130a823982b0', part_name: 'Pantalla', unit_cost: 50, unit_price: 80, quantity: 1 }],
      closeout: [{
        id: 'closeout-1', outcome: 'unrepairable', charge_mode: 'labor_and_consumed_parts',
        labor_charge: 20, consumed_parts_charge: 80, final_charge: 100, paid_before: 150,
        settlement_kind: 'store_credit', settlement_amount: 50, settlement_method: null,
        reason: 'Daño de placa', note: 'Cliente informado', created_at: '2026-08-15T10:00:00Z',
        parts_resolution: [{ repairPartId: '6d8238d2-fdc5-4939-85d7-130a823982b0', name: 'Pantalla', quantity: 1, unitPrice: 80, disposition: 'consumed' }],
      }],
    })

    expect(repair.parts[0].databaseId).toBe('6d8238d2-fdc5-4939-85d7-130a823982b0')
    expect(repair.closeout).toMatchObject({
      id: 'closeout-1', finalCharge: 100, paidBefore: 150, settlementKind: 'store_credit', settlementAmount: 50,
    })
  })

  it('maps the canonical cost summary and per-part tax snapshots', () => {
    const repair = mapSupabaseRepairToUi({
      id: 'repair-1', device_brand: 'Apple', device_model: 'iPhone', problem_description: 'Pantalla',
      status: 'reparacion', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-20T00:00:00Z',
      labor_cost: 110_000, final_cost: 300_000, paid_amount: 100_000,
      additional_charges: 5_000, deductions: 0, discount_amount: 20_000,
      parts: [{
        id: 'part-1', part_name: 'Pantalla', unit_cost: 80_000, unit_price: 105_000,
        quantity: 1, discount_amount: 5_000, tax_rate: 10,
      }],
      currentCostRevision: {
        id: 'revision-1', revision_number: 2, parts_subtotal: 190_000,
        parts_internal_cost: 150_000, subtotal_before_discount: 320_000,
        final_total: 300_000, balance_snapshot: 200_000,
        tax_breakdown: [{ rate: 10, grossAmount: 300_000, taxableBase: 272_727, taxAmount: 27_273 }],
      },
    })

    expect(repair.costSummary).toMatchObject({
      laborAmount: 110_000, partsSubtotal: 190_000, finalTotal: 300_000,
      paidAmount: 100_000, balance: 200_000,
    })
    expect(repair.parts[0]).toMatchObject({ discountAmount: 5_000, taxRate: 10 })
  })
})
