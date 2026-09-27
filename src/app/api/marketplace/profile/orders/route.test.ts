import { describe, expect, it } from 'vitest'
import { decodeOrderCursor, orderHistoryQuerySchema } from './route'

describe('marketplace order history contract', () => {
  it('accepts combined valid filters', () => {
    expect(orderHistoryQuerySchema.safeParse({ organization: 'moda-sur', status: 'DELIVERED', payment: 'PAID', from: '2026-01-01', to: '2026-09-06' }).success).toBe(true)
  })

  it('rejects unknown statuses and inverted dates', () => {
    expect(orderHistoryQuerySchema.safeParse({ status: 'OTHER' }).success).toBe(false)
    expect(orderHistoryQuerySchema.safeParse({ from: '2026-09-06', to: '2026-01-01' }).success).toBe(false)
  })

  it('decodes only a dated UUID cursor', () => {
    const cursor = '2026-09-06T12:00:00.000Z|00000000-0000-4000-8000-000000000001'
    expect(decodeOrderCursor(cursor)).toEqual({ createdAt: '2026-09-06T12:00:00.000Z', id: '00000000-0000-4000-8000-000000000001' })
    expect(decodeOrderCursor('not-a-cursor')).toBeNull()
  })
})
