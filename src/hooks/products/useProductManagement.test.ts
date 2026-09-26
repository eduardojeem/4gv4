import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/hooks/products/useProductManagement.ts'), 'utf8')

describe('useProductManagement contract', () => {
  it('usa valores iniciales seguros para filtro, orden y paginación', () => {
    expect(SOURCE).toContain("initialSort: ProductSort = { field: 'name', direction: 'asc' }")
    expect(SOURCE).toContain('initialPagination: PaginationOptions = { page: 1, limit: 20 }')
  })

  it('calcula la paginación desde el límite vigente', () => {
    expect(SOURCE).toContain('totalPages: Math.ceil(totalCount / pagination.limit)')
    expect(SOURCE).toContain('hasNextPage: pagination.page < Math.ceil(totalCount / pagination.limit)')
  })

  it('agrupa carga de consulta, lote y procesamiento', () => {
    expect(SOURCE).toContain('loading: loading || bulkOperationLoading || isProcessing')
    expect(SOURCE).toContain('loadingState: enhancedLoadingState')
  })

  it('expone las operaciones usadas por la interfaz actual', () => {
    for (const operation of ['createProduct,', 'updateProduct,', 'deleteProduct,', 'bulkUpdateProducts,', 'bulkDeleteProducts,']) {
      expect(SOURCE).toContain(operation)
    }
  })
})
