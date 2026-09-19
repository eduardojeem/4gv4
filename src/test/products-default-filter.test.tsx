import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useProductsDashboard } from '@/hooks/useProductsDashboard'
import { applyFilters } from '@/lib/products-dashboard-utils'
import type { Product } from '@/types/product-unified'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const producto = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Cargador USB-C 25W',
  sku: 'CAR-25W',
  sale_price: 85000,
  stock_quantity: 10,
  min_stock: 2,
  is_active: true,
  ...over,
} as Product)

const montar = (initialFilters?: Record<string, unknown>) =>
  renderHook(() =>
    useProductsDashboard({
      products: [],
      categories: [],
      suppliers: [],
      alerts: [],
      serverPaginated: true,
      serverTotalItems: 0,
      initialFilters: initialFilters as never,
    }),
  )

/**
 * El listado de productos abría con todo mezclado: la mano de obra y las
 * reparaciones aparecían entre los productos del estante.
 */
describe('con qué filtro abre el listado de productos', () => {
  it('arranca en «solo productos» cuando se lo pide la pantalla', () => {
    const { result } = montar({ quick_filter: 'products' })
    expect(result.current.filters.quick_filter).toBe('products')
  })

  it('sin filtro inicial se comporta como antes', () => {
    const { result } = montar()
    expect(result.current.filters).toEqual({})
  })

  /** Limpiar no tiene por qué mezclar los servicios de vuelta. */
  it('limpiar vuelve al filtro con el que abrió, no a todo', () => {
    const { result } = montar({ quick_filter: 'products' })

    act(() => result.current.handleQuickFilter('services'))
    expect(result.current.filters.quick_filter).toBe('services')

    act(() => result.current.clearFilters())
    expect(result.current.filters.quick_filter).toBe('products')
  })

  it('se puede pasar a todo y a solo servicios', () => {
    const { result } = montar({ quick_filter: 'products' })

    act(() => result.current.handleQuickFilter('all'))
    expect(result.current.filters.quick_filter).toBe('all')

    act(() => result.current.handleQuickFilter('services'))
    expect(result.current.filters.quick_filter).toBe('services')
  })
})

describe('qué deja pasar cada filtro', () => {
  const servicio = producto({ id: 's1', name: 'Reparación de pantalla', sku: 'SRV-757413-394' })
  const fisico = producto({ id: 'p2', name: 'Vidrio templado', sku: 'VID-01' })

  it('«solo productos» deja afuera la mano de obra', () => {
    const visibles = applyFilters([fisico, servicio], { quick_filter: 'products' })
    expect(visibles.map((item) => item.id)).toEqual(['p2'])
  })

  it('«solo servicios» deja solo la mano de obra', () => {
    const visibles = applyFilters([fisico, servicio], { quick_filter: 'services' })
    expect(visibles.map((item) => item.id)).toEqual(['s1'])
  })

  it('«todos» no saca nada', () => {
    expect(applyFilters([fisico, servicio], { quick_filter: 'all' })).toHaveLength(2)
  })
})

/**
 * Con paginación del servidor, filtrar en el navegador mostraría menos filas de
 * las que dice el total: el tipo de catálogo tiene que viajar en la consulta.
 */
describe('el filtro viaja al servidor', () => {
  it('la pantalla traduce el filtro rápido a productos o servicios', () => {
    const page = leer('src/app/dashboard/products/page.tsx')
    expect(page).toContain('initialFilters: PRODUCTS_ONLY_FILTERS')
    expect(page).toContain('quick_filter: "products"')
    expect(page).toContain('? ("part" as const)')
    expect(page).toContain('? ("service" as const)')
    expect(page).toContain('catalogKind: quickFilterCatalogKind')
  })

  it('el hook lo manda como parámetro de la consulta', () => {
    const hook = leer('src/hooks/useProductsSupabase.ts')
    expect(hook).toContain("params.set('catalog_kind', activeFilters.catalogKind)")
  })

  it('la API entiende ese parámetro y ajusta el total', () => {
    const api = leer('src/app/api/products/route.ts')
    expect(api).toContain("parseProductCatalogKind(searchParams.get('catalog_kind'))")
    expect(api).toContain('filterProductsByCatalogKind(stockFilteredProducts, catalogKind)')
    // El total sale de lo filtrado, no del conteo crudo de la tabla.
    expect(api).toContain('catalogKind !== null')
  })
})
