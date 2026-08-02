import { describe, expect, it, vi } from 'vitest'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

describe('fetchAllRows', () => {
  it('continues until the database returns a partial page', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3], error: null })

    await expect(fetchAllRows(fetchPage, 2)).resolves.toEqual([1, 2, 3])
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 1)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 3)
  })

  it('surfaces database errors instead of returning an empty list', async () => {
    await expect(fetchAllRows(
      async () => ({ data: null, error: { message: 'database unavailable' } })
    )).rejects.toThrow('database unavailable')
  })
})

describe('chunkValues', () => {
  it('splits large in-filters into bounded requests', () => {
    expect(chunkValues([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
