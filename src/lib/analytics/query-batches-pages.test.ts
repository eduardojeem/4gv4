import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from './query-batches'

function source(total: number, failAt?: number) {
  const calls: Array<[number, number]> = []
  const makeQuery = vi.fn(() => ({
    range: async (from: number, to: number) => {
      calls.push([from, to])
      if (failAt !== undefined && from >= failAt) return { data: null, error: { message: 'boom' } }
      const rows = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => ({ id: from + i }))
      return { data: rows, error: null }
    },
  }))
  return { makeQuery, calls }
}

describe('fetchAllPages', () => {
  it('trae más de 1000 filas pidiendo de a páginas', async () => {
    const { makeQuery, calls } = source(2500)
    const result = await fetchAllPages(makeQuery)
    expect(result.data).toHaveLength(2500)
    expect(result.truncated).toBe(false)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('con exactamente una página pide una más para confirmar que no hay más', async () => {
    const { makeQuery, calls } = source(1000)
    expect((await fetchAllPages(makeQuery)).data).toHaveLength(1000)
    expect(calls).toHaveLength(2)
  })

  it('devuelve el error en vez de totales incompletos silenciosos', async () => {
    const { makeQuery } = source(3000, 1000)
    const result = await fetchAllPages(makeQuery)
    expect(result.error).toEqual({ message: 'boom' })
  })

  it('avisa si se alcanza el máximo', async () => {
    const { makeQuery } = source(10000)
    const result = await fetchAllPages(makeQuery, { pageSize: 1000, maxRows: 3000 })
    expect(result.data).toHaveLength(3000)
    expect(result.truncated).toBe(true)
  })
})
