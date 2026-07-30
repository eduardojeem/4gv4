import { describe, expect, it } from 'vitest'
import { chunkQueryValues } from '@/lib/analytics/query-batches'

describe('chunkQueryValues', () => {
  it('keeps every value when a query exceeds the batch size', () => {
    const values = Array.from({ length: 1201 }, (_, index) => `sale-${index}`)
    const chunks = chunkQueryValues(values, 500)

    expect(chunks.map((chunk) => chunk.length)).toEqual([500, 500, 201])
    expect(chunks.flat()).toEqual(values)
  })
})
