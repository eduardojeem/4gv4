import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/mocks/server'
import { useRepairCatalogSearch } from './useRepairCatalogSearch'

const service = {
  id: 'service-1',
  name: 'Cambio de pantalla',
  unit_measure: 'servicio',
  sale_price: 180_000,
  category: { name: 'Servicios' },
}

const part = {
  id: 'part-1',
  name: 'Módulo A05',
  unit_measure: 'unidad',
  sale_price: 120_000,
  stock_quantity: 3,
  category: { name: 'Repuestos' },
}

describe('useRepairCatalogSearch', () => {
  it('requests current branch stock and keeps only physical parts', async () => {
    let branchHeader: string | null = null
    let strictStock: string | null = null
    let catalogKind: string | null = null
    let isActive: string | null = null
    server.use(http.get('/api/products', ({ request }) => {
      const url = new URL(request.url)
      branchHeader = request.headers.get('x-branch-id')
      strictStock = url.searchParams.get('strict_branch_stock')
      catalogKind = url.searchParams.get('catalog_kind')
      isActive = url.searchParams.get('is_active')
      return HttpResponse.json({ data: { products: [service, part] } })
    }))

    const { result } = renderHook(() => useRepairCatalogSearch({
      kind: 'part', branchId: 'branch-a', open: true, query: 'módulo', debounceMs: 0,
    }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(branchHeader).toBe('branch-a')
    expect(strictStock).toBe('true')
    expect(catalogKind).toBe('part')
    expect(isActive).toBe('true')
    expect(result.current.items.map((item) => item.id)).toEqual(['part-1'])
  })

  it('classifies service-category products as services and refreshes on demand', async () => {
    let requests = 0
    let catalogKind: string | null = null
    const categoryService = { ...service, id: 'service-2', unit_measure: 'unidad' }
    server.use(http.get('/api/products', ({ request }) => {
      requests += 1
      catalogKind = new URL(request.url).searchParams.get('catalog_kind')
      return HttpResponse.json({ data: { products: [categoryService, part] } })
    }))

    const { result } = renderHook(() => useRepairCatalogSearch({
      kind: 'service', branchId: 'branch-a', open: true, query: '', debounceMs: 0,
    }))

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0].id).toBe('service-2')
    expect(catalogKind).toBe('service')

    act(() => result.current.refresh())
    await waitFor(() => expect(requests).toBe(2))
  })

  it('preserves an actionable error and retries without reopening', async () => {
    let shouldFail = true
    server.use(http.get('/api/products', () => {
      if (shouldFail) return HttpResponse.json({ error: 'Sin conexión' }, { status: 503 })
      return HttpResponse.json({ data: { products: [part] } })
    }))

    const { result } = renderHook(() => useRepairCatalogSearch({
      kind: 'part', branchId: 'branch-a', open: true, query: '', debounceMs: 0,
    }))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Sin conexión')

    shouldFail = false
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.items).toHaveLength(1)
  })
})
