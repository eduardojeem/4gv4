import { describe, expect, it } from 'vitest'
import { summarizeRepairs } from './organization-volume'

describe('reparaciones del mes en la ficha de la organización', () => {
  it('cuenta las del mes corriente, que es lo que limita el plan', () => {
    const now = new Date(2026, 9, 15, 12) // 15 de octubre
    const summary = summarizeRepairs([
      { status: 'recibido', created_at: new Date(2026, 9, 1, 9).toISOString() },
      { status: 'entregado', created_at: new Date(2026, 9, 14, 9).toISOString(), final_cost: 100, paid_amount: 100 },
      { status: 'entregado', created_at: new Date(2026, 8, 30, 9).toISOString(), final_cost: 100, paid_amount: 100 },
      { status: 'recibido', created_at: new Date(2026, 5, 2, 9).toISOString() },
    ], now)
    expect(summary.total).toBe(4)
    expect(summary.thisMonth).toBe(2)
  })
})
