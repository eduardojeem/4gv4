import { describe, it, expect } from 'vitest'
import { repairAuthSchema } from '@/schemas/public-auth.schema'

describe('repairAuthSchema', () => {
  it('acepta formato R-YYYY-XXXXX', () => {
    const result = repairAuthSchema.safeParse({
      contact: 'cliente@example.com',
      ticketNumber: 'R-2026-00042'
    })
    expect(result.success).toBe(true)
  })

  it('acepta formato REP-XXXXXX', () => {
    const result = repairAuthSchema.safeParse({
      contact: '+595981234567',
      ticketNumber: 'REP-000042'
    })
    expect(result.success).toBe(true)
  })

  it('normaliza mayúsculas en ticket', () => {
    const result = repairAuthSchema.safeParse({
      contact: 'cliente@example.com',
      ticketNumber: 'rep-000042'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ticketNumber).toBe('REP-000042')
    }
  })

  it('rechaza formatos inválidos', () => {
    const result = repairAuthSchema.safeParse({
      contact: 'cliente@example.com',
      ticketNumber: 'INVALID-42'
    })
    expect(result.success).toBe(false)
  })
})
