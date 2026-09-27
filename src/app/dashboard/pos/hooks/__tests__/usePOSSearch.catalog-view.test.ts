import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@/types/product-unified'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('../useSmartSearch', () => ({
  useSmartSearch: () => ({
    setQuery: vi.fn(),
    searchResults: [],
    suggestions: [],
    isSearching: false,
    addToRecentSearches: vi.fn(),
  }),
}))

import { usePOSSearch } from '../usePOSSearch'
import { countByCatalogView, isPOSService } from '../../lib/catalog-view'

const item = (overrides: Partial<Product>): Product => ({
  id: 'p',
  name: 'Funda silicona',
  sku: 'FUN-1',
  barcode: null,
  sale_price: 50000,
  stock_quantity: 10,
  unit_measure: 'unidad',
  category: { id: 'c1', name: 'Accesorios' },
  ...overrides,
}) as Product

const catalog = [
  item({ id: 'p1', name: 'Funda silicona' }),
  item({ id: 'p2', name: 'Cargador 20W', sku: 'CAR-1', category: { id: 'c2', name: 'Cargadores' } as Product['category'] }),
  item({ id: 's1', name: 'Pantalla A12', sku: 'PAN-1', unit_measure: 'servicio', stock_quantity: 9999, category: { id: 'c3', name: 'Reparaciones' } as Product['category'] }),
  item({ id: 's2', name: 'Diagnóstico general', sku: 'SRV-DIA', stock_quantity: 9999, category: { id: 'c4', name: 'Servicios' } as Product['category'] }),
]

beforeEach(() => { localStorage.clear() })

describe('regla de servicio del POS', () => {
  it('usa la misma regla que el resto del sistema', () => {
    expect(isPOSService(catalog[2])).toBe(true) // unidad «servicio»
    expect(isPOSService(catalog[3])).toBe(true) // categoría y SKU de servicio
    expect(isPOSService(catalog[0])).toBe(false)
    expect(countByCatalogView(catalog)).toEqual({ products: 2, services: 2 })
  })
})

describe('usePOSSearch: productos y servicios por separado', () => {
  it('arranca mostrando solo productos', () => {
    const { result } = renderHook(() => usePOSSearch({ products: catalog }))

    expect(result.current.catalogView).toBe('products')
    expect(result.current.filteredProducts.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
    expect(result.current.catalogCounts).toEqual({ products: 2, services: 2 })
  })

  it('al elegir servicios muestra solo servicios y sus categorías', () => {
    const { result } = renderHook(() => usePOSSearch({ products: catalog }))
    act(() => result.current.setCatalogView('services'))

    expect(result.current.filteredProducts.map((p) => p.id).sort()).toEqual(['s1', 's2'])
    expect(result.current.categories).toEqual(['all', 'Reparaciones', 'Servicios'])
  })

  it('al cambiar de vista suelta la categoría elegida', () => {
    const { result } = renderHook(() => usePOSSearch({ products: catalog }))
    act(() => result.current.setSelectedCategory('Cargadores'))
    act(() => result.current.setCatalogView('services'))

    expect(result.current.selectedCategory).toBe('all')
    expect(result.current.filteredProducts).toHaveLength(2)
  })

  it('avisa cuando lo buscado está en la otra vista', async () => {
    const { result } = renderHook(() => usePOSSearch({ products: catalog }))
    act(() => result.current.setSearchTerm('pantalla'))

    await waitFor(() => expect(result.current.debouncedSearchTerm).toBe('pantalla'))
    expect(result.current.filteredProducts).toHaveLength(0)
    expect(result.current.otherViewMatches).toBe(1)
  })
})
