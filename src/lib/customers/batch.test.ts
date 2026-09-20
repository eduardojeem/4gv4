import { describe, expect, it } from 'vitest'
import { chunkIds } from './batch'

describe('chunkIds', () => {
  it('deduplicates ids and keeps every id in bounded batches', () => {
    expect(chunkIds(['a', 'b', 'a', 'c', 'd'], 2)).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('rejects an invalid batch size', () => {
    expect(() => chunkIds(['a'], 0)).toThrow('tamaño del lote')
  })
})
