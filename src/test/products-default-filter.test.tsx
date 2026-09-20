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
 * El listado abría con todo mezclado: la mano de obra, las reparaciones y los
 * productos ya desactivados aparecían entre los del estante. Y el filtro se
 * perdía al toque: pedir «bajo stock» reemplazaba todo el estado y los
 * servicios volvían, sin que nada lo dijera en pantalla.
 */
const ALCANCE = { catalog_kind: 'part', is_active: true } as const

describe('con qué alcance abre el listado de productos', () => {
  it('abre con los productos cargados, activos y sin servicios', () => {
    const { result } = montar(ALCANCE)
    expect(result.current.filters.catalog_kind).toBe('part')
    expect(result.current.filters.is_active).toBe(true)
  })

  it('sin alcance inicial se comporta como antes', () => {
    const { result } = montar()
    expect(result.current.filters).toEqual({})
  })

  /** El caso que se rompía: el tipo y el estado tienen que sobrevivir. */
  it('pedir «bajo stock» no vuelve a mezclar servicios ni desactivados', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('low_stock'))

    expect(result.current.filters.quick_filter).toBe('low_stock')
    expect(result.current.filters.catalog_kind).toBe('part')
    expect(result.current.filters.is_active).toBe(true)
  })

  it('cambiar a servicios no toca el estado', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('services'))

    expect(result.current.filters.catalog_kind).toBe('service')
    expect(result.current.filters.is_active).toBe(true)
  })

  it('ver los inactivos no trae los servicios de vuelta', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('inactive'))

    expect(result.current.filters.is_active).toBe(false)
    expect(result.current.filters.catalog_kind).toBe('part')
  })

  /** Volver a tocar el filtro puesto lo apaga: es la forma de ensanchar. */
  it('tocar dos veces el mismo filtro lo apaga', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('active'))
    expect(result.current.filters.is_active).toBeUndefined()

    act(() => result.current.handleQuickFilter('products'))
    expect(result.current.filters.catalog_kind).toBeUndefined()

    act(() => result.current.handleQuickFilter('low_stock'))
    act(() => result.current.handleQuickFilter('low_stock'))
    expect(result.current.filters.quick_filter).toBeNull()
  })

  /** Un eje apagado a mano no se vuelve a encender solo. */
  it('lo que se apagó sigue apagado al pedir otro filtro', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('active'))
    act(() => result.current.handleQuickFilter('out_of_stock'))

    expect(result.current.filters.is_active).toBeUndefined()
    expect(result.current.filters.quick_filter).toBe('out_of_stock')
  })

  it('«todos» es la salida al catálogo completo', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('all'))

    expect(result.current.filters).toEqual({})
  })

  /** Limpiar no tiene por qué mezclar los servicios de vuelta. */
  it('limpiar vuelve al alcance con el que abrió, no a todo', () => {
    const { result } = montar(ALCANCE)

    act(() => result.current.handleQuickFilter('all'))
    act(() => result.current.clearFilters())

    expect(result.current.filters).toEqual(ALCANCE)
  })
})
describe('qué deja pasar cada filtro', () => {
  const servicio = producto({ id: 's1', name: 'Reparación de pantalla', sku: 'SRV-757413-394' })
  const fisico = producto({ id: 'p2', name: 'Vidrio templado', sku: 'VID-01' })

  it('el alcance «productos» deja afuera la mano de obra', () => {
    const visibles = applyFilters([fisico, servicio], { catalog_kind: 'part' })
    expect(visibles.map((item) => item.id)).toEqual(['p2'])
  })

  it('el alcance «servicios» deja solo la mano de obra', () => {
    const visibles = applyFilters([fisico, servicio], { catalog_kind: 'service' })
    expect(visibles.map((item) => item.id)).toEqual(['s1'])
  })

  it('el alcance convive con el filtro de stock', () => {
    const agotado = producto({ id: 'p3', name: 'Funda', sku: 'FUN-01', stock_quantity: 0 })
    const visibles = applyFilters([fisico, servicio, agotado], {
      catalog_kind: 'part',
      quick_filter: 'out_of_stock',
    })
    expect(visibles.map((item) => item.id)).toEqual(['p3'])
  })

  it('los filtros rápidos viejos siguen funcionando', () => {
    expect(applyFilters([fisico, servicio], { quick_filter: 'products' })).toHaveLength(1)
    expect(applyFilters([fisico, servicio], { quick_filter: 'all' })).toHaveLength(2)
  })
})

/**
 * Con paginación del servidor, filtrar en el navegador mostraría menos filas de
 * las que dice el total: el tipo de catálogo tiene que viajar en la consulta.
 */
describe('el filtro viaja al servidor', () => {
  it('la pantalla abre con el alcance de la sección', () => {
    const page = leer('src/app/dashboard/products/page.tsx')
    expect(page).toContain('initialFilters: PRODUCTS_SECTION_SCOPE')
    expect(page).toContain('catalog_kind: "part", is_active: true')
    expect(page).toContain('catalogKind: quickFilterCatalogKind')
  })

  /** Pasar de productos a servicios no cambia ningún otro campo. */
  it('el cambio de tipo llega al servidor', () => {
    const page = leer('src/app/dashboard/products/page.tsx')
    expect(page).toContain('prev.catalogKind === next.catalogKind')
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

describe('cálculo de stock y preservación de estado al alternar visibilidad', () => {
  it('producto con variantes con stock no se marca como agotado aunque stock_quantity base sea 0', async () => {
    const { getStockStatus, isOutOfStock } = await import('@/lib/products-dashboard-utils')
    const productoConVariantes = producto({
      stock_quantity: 0,
      variants: [
        { id: 'v1', stock_quantity: 5, is_active: true } as any,
        { id: 'v2', stock_quantity: 3, is_active: true } as any,
      ],
    })

    expect(isOutOfStock(productoConVariantes)).toBe(false)
    expect(getStockStatus(productoConVariantes)).toBe('in_stock')
  })

  it('el hook useProductsSupabase preserva stock y variantes al actualizar visibilidad', () => {
    const hook = leer('src/hooks/useProductsSupabase.ts')
    expect(hook).toContain('isStockTouched')
    expect(hook).toContain('p.stock_quantity ?? updatedProduct.stock_quantity')
    expect(hook).toContain('p.variants ?? updatedProduct.variants')
  })

  it('PUT /api/products recarga relaciones y stock de sucursal aun sin desiredStockQuantity', () => {
    const api = leer('src/app/api/products/route.ts')
    expect(api).toContain('variants:product_variants(*)')
    expect(api).toContain('loadBranchInventoryStockMap(')
    expect(api).toContain('branchInventoryClient,')
  })
})
