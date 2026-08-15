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
})
