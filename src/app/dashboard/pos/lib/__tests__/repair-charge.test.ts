import { describe, expect, it } from 'vitest'

import {
  getRepairBalanceDue,
  getRepairChargeability,
  getRepairDeliveryEligibility,
} from '../repair-charge'

describe('getRepairBalanceDue', () => {
  it('charges the full cost when nothing was paid yet', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 0 })).toBe(500)
    expect(getRepairBalanceDue({ final_cost: null, estimated_cost: 300, paid_amount: null })).toBe(300)
  })

  it('charges only the remaining balance after a partial payment', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 200 })).toBe(300)
    expect(getRepairBalanceDue({ estimated_cost: 300, paid_amount: 100 })).toBe(200)
  })

  it('charges nothing for a repair that is already fully paid', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 500 })).toBe(0)
  })

  it('never goes negative even if paid_amount overshoots the cost', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 600 })).toBe(0)
  })

  it('prefers final_cost over estimated_cost when both are set', () => {
    expect(getRepairBalanceDue({ final_cost: 450, estimated_cost: 500, paid_amount: 50 })).toBe(400)
  })

  it('rounds to cents', () => {
    expect(getRepairBalanceDue({ final_cost: 100.005, paid_amount: 0.001 })).toBeCloseTo(100, 2)
  })
})

describe('getRepairChargeability', () => {
  it('blocks a fully paid repair instead of falling back to gross cost', () => {
    expect(getRepairChargeability({ final_cost: 500, paid_amount: 500, status: 'listo' }))
      .toEqual({ canCharge: false, balanceDue: 0, reason: 'Sin saldo pendiente' })
  })

  it('allows charging an in-progress repair without making it deliverable', () => {
    expect(getRepairChargeability({ final_cost: 500, paid_amount: 100, status: 'reparacion' }).canCharge).toBe(true)
    expect(getRepairDeliveryEligibility([
      { ticket_number: 'R-1', status: 'reparacion', qualityCheck: null },
    ]).canDeliver).toBe(false)
  })

  it('treats invalid or non-positive money inputs as no balance', () => {
    expect(getRepairChargeability({ final_cost: Number.NaN, paid_amount: 0, status: 'listo' }))
      .toMatchObject({ canCharge: false, balanceDue: 0 })
    expect(getRepairChargeability({ final_cost: -100, paid_amount: 0, status: 'listo' }))
      .toMatchObject({ canCharge: false, balanceDue: 0 })
  })

  it('blocks a repair whose payment status already says paid', () => {
    expect(getRepairChargeability({
      final_cost: 500,
      paid_amount: 0,
      payment_status: 'pagado',
      status: 'listo',
    })).toEqual({ canCharge: false, balanceDue: 0, reason: 'Sin saldo pendiente' })
  })
})

describe('getRepairDeliveryEligibility', () => {
  it('does not allow delivery for an empty selection', () => {
    expect(getRepairDeliveryEligibility([])).toEqual({
      canDeliver: false,
      blockingTickets: [],
      reason: 'Seleccioná al menos una reparación',
    })
  })

  it('identifies every ticket that is not ready or lacks a passed quality check', () => {
    expect(getRepairDeliveryEligibility([
      { ticket_number: 'A', status: 'listo', qualityCheck: { result: 'passed' } },
      { ticket_number: 'B', status: 'diagnostico', qualityCheck: { result: 'passed' } },
      { ticket_number: 'C', status: 'listo', qualityCheck: { result: 'failed' } },
    ])).toEqual({
      canDeliver: false,
      blockingTickets: ['B', 'C'],
      reason: 'Falta estado Listo o control técnico aprobado',
    })
  })

  it('allows delivery only when every repair is ready and passed quality control', () => {
    expect(getRepairDeliveryEligibility([
      { ticket_number: 'A', status: 'LISTO', qualityCheck: { result: 'passed' } },
      { ticket_number: 'B', status: 'ready_for_pickup', qualityCheck: [{ result: 'passed' }] },
    ])).toEqual({ canDeliver: true, blockingTickets: [] })
  })
})
