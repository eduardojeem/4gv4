import { describe, expect, it } from 'vitest'
import { paginateList } from '@/lib/superadmin/list-pagination'

describe('paginateList', () => {
  const rows = Array.from({ length: 61 }, (_, index) => index + 1)

  it('returns the requested page with a supported size', () => {
    const result = paginateList(rows, '2', '25')

    expect(result.items).toEqual(rows.slice(25, 50))
    expect(result.page).toBe(2)
    expect(result.totalPages).toBe(3)
  })

  it('clamps invalid pages and page sizes', () => {
    const result = paginateList(rows, '99', '7')

    expect(result.pageSize).toBe(25)
    expect(result.page).toBe(3)
    expect(result.items).toEqual(rows.slice(50))
  })

  it('keeps an empty list on page one', () => {
    expect(paginateList([], '4', '50')).toEqual({
      items: [],
      page: 1,
      pageSize: 50,
      totalPages: 1,
    })
  })
})
