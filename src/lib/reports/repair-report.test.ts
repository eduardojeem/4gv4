import { describe, expect, it } from 'vitest'

import { calculateRepairCompletion } from './repair-report'

describe('calculateRepairCompletion', () => {
  it('counts delivered repairs even when legacy timing fields are missing', () => {
    const result = calculateRepairCompletion([
      { status: 'entregado', receivedAt: null, completedAt: null },
      { status: 'entregado', receivedAt: '2026-08-01T12:00:00Z', completedAt: '2026-08-03T12:00:00Z' },
      { status: 'en_reparacion', receivedAt: '2026-08-01T12:00:00Z', completedAt: null },
    ])
    expect(result).toMatchObject({
      deliveredCount: 2,
      averageTurnaroundDays: 2,
      timedDeliveredCount: 1,
    })
    expect(result.completionRate).toBeCloseTo(200 / 3)
  })
})
