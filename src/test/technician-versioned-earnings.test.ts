import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPENSATION } from '@/lib/technician/earnings'
describe('versioned technician earnings', () => {
  it('uses organization timezone rather than server UTC for a monthly period', async () => {
    const { technicianMonthPeriod } = await import('@/lib/technician/period')
    expect(technicianMonthPeriod('2026-10', 'America/Asuncion')).toEqual({ from: '2026-10-01T03:00:00.000Z', to: '2026-11-01T03:00:00.000Z', fromDate: '2026-10-01', toDate: '2026-11-01' })
    expect(() => technicianMonthPeriod('2026-99', 'UTC')).toThrow('TECHNICIAN_INVALID_PERIOD')
  })
  it('uses historical terms for each repair and prorates salary changes', async () => {
    const { computeVersionedEarnings } = await import('@/lib/technician/versioned-earnings')
    const versions = [
      { effective_from: '2026-10-01', config: { ...DEFAULT_COMPENSATION, base_salary: 100, commission_rate: 10, fixed_per_repair: 5 } },
      { effective_from: '2026-10-21', config: { ...DEFAULT_COMPENSATION, commission_rate: 20, fixed_per_repair: 7 } },
    ]
    const repairs = [{ status: 'entregado', delivered_at: '2026-10-05T12:00:00Z', labor_cost: 100 }, { status: 'entregado', delivered_at: '2026-10-25T12:00:00Z', labor_cost: 100 }]
    const result = computeVersionedEarnings(versions, repairs, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'UTC')
    expect(result.earnings).toEqual({ base: 64.52, commission: 30, fixed: 12, total: 106.52, repairsCount: 2 })
  })
  it('does not earn the same repair again after the accrual mode changes', async () => {
    const { computeVersionedEarnings } = await import('@/lib/technician/versioned-earnings')
    const versions = [
      { effective_from: '2026-09-01', config: { ...DEFAULT_COMPENSATION, accrual_status: 'listo' as const, fixed_per_repair: 5 } },
      { effective_from: '2026-10-01', config: { ...DEFAULT_COMPENSATION, fixed_per_repair: 10 } },
    ]
    const result = computeVersionedEarnings(versions, [{ status: 'entregado', completed_at: '2026-09-29T12:00:00Z', delivered_at: '2026-10-05T12:00:00Z' }], '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'UTC')
    expect(result.earnings.repairsCount).toBe(0)
  })
})
