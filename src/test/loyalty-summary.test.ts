import { describe, expect, it } from 'vitest'
import { getRaffleOperationalSummary } from '@/components/dashboard/loyalty/loyalty-summary'

describe('getRaffleOperationalSummary', () => {
  it('separa sorteos abiertos, próximos a cerrar y pendientes de sorteo', () => {
    const now = new Date()
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    expect(
      getRaffleOperationalSummary([
        { status: 'published', ends_at: inThreeDays, tickets: [{ count: 4 }] },
        { status: 'published', ends_at: inThirtyDays, tickets: [{ count: 2 }] },
        { status: 'closed', ends_at: inThreeDays, tickets: [{ count: 1 }] },
        { status: 'completed', ends_at: inThreeDays, tickets: [{ count: 8 }] },
      ] as never)
    ).toMatchObject({ open: 2, closingSoon: 1, pendingDraw: 1, completed: 1, tickets: 15 })
  })
})
