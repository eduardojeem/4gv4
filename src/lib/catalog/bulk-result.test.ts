import { describe, expect, it } from 'vitest'
import { bulkResultSucceeded, isBulkCatalogResult } from './bulk-result'

describe('BulkCatalogResult', () => {
  const valid = { requested: 3, created: 0, updated: 0, linked: 2, skipped: 1, failed: [] }

  it('acepta el contrato completo y solo considera éxito cuando no hay fallos', () => {
    expect(isBulkCatalogResult(valid)).toBe(true)
    expect(bulkResultSucceeded(valid)).toBe(true)
    expect(bulkResultSucceeded({ ...valid, failed: [{ id: 'x', reason: 'inválido' }] })).toBe(false)
  })

  it('rechaza arreglos ausentes y contadores negativos', () => {
    expect(isBulkCatalogResult({ ...valid, failed: undefined })).toBe(false)
    expect(isBulkCatalogResult({ ...valid, linked: -1 })).toBe(false)
  })
})
