import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryCall = { method: string; args: unknown[] }

let productRows: Record<string, unknown>[] = []
let productCalls: QueryCall[] = []

function createFakeClient() {
  return {
    from(table: string) {
      const calls: QueryCall[] = []
      // La sonda de columnas tambien usa `products`: el query real es el que
      // pide el conteo, y es el que interesa mirar.
      if (table === 'products') productCalls = calls

      const builder: Record<string | symbol, unknown> = new Proxy({}, {
        get(_target, prop) {
          if (prop === 'then') {
            // Sin ninguna tienda en vitrina el catalogo corta antes de
            // consultar productos, asi que la lista tiene que traer una.
            if (table === 'organizations') {
              return (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
                Promise.resolve({ data: [{ id: 'org-1' }], count: 1, error: null }).then(onFulfilled, onRejected)
            }
            // Las columnas opcionales (celular, precio oculto) se preguntan con
            // un select vacio: se responde que no existen.
            const probe = calls.find((call) => call.method === 'select' && /device_brand|hide_price/.test(String(call.args[0])))
            if (probe) {
              return (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
                Promise.resolve({ data: null, count: 0, error: { message: 'column does not exist' } }).then(onFulfilled, onRejected)
            }

            const limitCall = calls.find((call) => call.method === 'limit')
            const limit = Number(limitCall?.args[0] ?? productRows.length)
            const data = table === 'products' ? productRows.slice(0, limit) : []
            const result = table === 'products'
              ? { data, count: productRows.length, error: null }
              : { data, count: 0, error: null }

            return (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
              Promise.resolve(result).then(onFulfilled, onRejected)
          }

          return (...args: unknown[]) => {
            calls.push({ method: String(prop), args })
            return builder
          }
        },
      }) as Record<string | symbol, unknown>

      return builder
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => createFakeClient(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}))

import { getMarketplaceProductsPage } from '@/lib/public/marketplace'

function productRow(id: string) {
  return {
    id,
    organization_id: 'org-1',
    name: `Producto ${id}`,
    sku: id,
    description: null,
    brand: 'Marca',
    sale_price: 100_000,
    stock_quantity: 5,
    is_active: true,
    featured: false,
    has_offer: false,
    offer_price: null,
    image_url: null,
    images: null,
    unit_measure: 'unidad',
    barcode: null,
    categories: null,
    organizations: { id: 'org-1', name: 'Tienda', slug: 'tienda' },
  }
}

describe('getMarketplaceProductsPage', () => {
  beforeEach(() => {
    productRows = [productRow('1'), productRow('2'), productRow('3')]
    productCalls = []
  })

  it('separa el total exacto de la cantidad limitada de productos cargados', async () => {
    const result = await getMarketplaceProductsPage(2)

    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(3)
    expect(productCalls).toContainEqual({
      method: 'select',
      args: [expect.any(String), { count: 'exact' }],
    })
  })

  it('aplica los filtros al mismo query que obtiene el conteo', async () => {
    await getMarketplaceProductsPage(2, { q: 'funda', marca: 'Acme' })

    expect(productCalls).toContainEqual({ method: 'ilike', args: ['brand', 'Acme'] })
    // La busqueda cubre tambien SKU y descripcion: antes solo nombre y marca, y el
    // mismo termino daba resultados distintos que /marketplace/buscar.
    expect(productCalls).toContainEqual({
      method: 'or',
      args: ['name.ilike.%funda%,sku.ilike.%funda%,brand.ilike.%funda%,description.ilike.%funda%'],
    })
  })
})
