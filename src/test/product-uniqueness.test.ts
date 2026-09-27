import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { conflictMessage, findProductConflict } from '@/lib/products/uniqueness'
import { recordStockAdjustment } from '@/lib/products/stock-movements'

/**
 * Nada impedía que dos productos de la misma tienda compartieran el SKU: en el
 * catálogo hay dos con `store_babyliss`. Como el SKU es lo que se imprime en la
 * etiqueta cuando el producto no tiene código de barras, los dos terminan con
 * el mismo código y en el mostrador se cobra el equivocado.
 */

type Fila = { id: string; name: string | null; sku: string | null; barcode: string | null }

/** Un cliente de Supabase de mentira que devuelve las filas que se le den. */
function clienteCon(filas: Fila[], error: { message: string } | null = null) {
  const visto: { tabla?: string; columna?: string; valor?: string; filtro?: string } = {}
  const client = {
    from: (tabla: string) => {
      visto.tabla = tabla
      return {
        select: () => ({
          eq: (columna: string, valor: string) => {
            visto.columna = columna
            visto.valor = valor
            return {
              or: (filtro: string) => {
                visto.filtro = filtro
                return { limit: async () => ({ data: error ? null : filas, error }) }
              },
            }
          },
        }),
      }
    },
  }
  return { client, visto }
}

const OTRO = { id: 'otro', name: 'Babyliss Pro', sku: 'store_babyliss', barcode: '2001234567895' }

describe('el SKU y el código de barras no se repiten dentro de la tienda', () => {
  it('encuentra el producto que ya usa ese SKU', async () => {
    const { client } = clienteCon([OTRO])
    const conflicto = await findProductConflict(client, { organizationId: 'org', sku: 'store_babyliss' })
    expect(conflicto).toEqual({ field: 'sku', value: 'store_babyliss', name: 'Babyliss Pro', id: 'otro' })
  })

  it('el SKU no distingue mayúsculas: STORE_BABYLISS es el mismo código', async () => {
    const { client } = clienteCon([OTRO])
    const conflicto = await findProductConflict(client, { organizationId: 'org', sku: 'STORE_BABYLISS' })
    expect(conflicto?.field).toBe('sku')
  })

  it('encuentra el producto que ya usa ese código de barras', async () => {
    const { client } = clienteCon([OTRO])
    const conflicto = await findProductConflict(client, { organizationId: 'org', barcode: '2001234567895' })
    expect(conflicto).toMatchObject({ field: 'barcode', value: '2001234567895', name: 'Babyliss Pro' })
  })

  /** Editar un producto sin tocarle el SKU no puede chocar consigo mismo. */
  it('al editar, el propio producto no cuenta como conflicto', async () => {
    const { client } = clienteCon([OTRO])
    const conflicto = await findProductConflict(client, {
      organizationId: 'org',
      sku: 'store_babyliss',
      excludeId: 'otro',
    })
    expect(conflicto).toBeNull()
  })

  it('busca solo dentro de la organización', async () => {
    const { client, visto } = clienteCon([])
    await findProductConflict(client, { organizationId: 'org-1', sku: 'ABC' })
    expect(visto.tabla).toBe('products')
    expect(visto.columna).toBe('organization_id')
    expect(visto.valor).toBe('org-1')
  })

  it('un producto sin SKU ni código no consulta nada', async () => {
    const consulta = vi.fn()
    const conflicto = await findProductConflict(
      { from: consulta as never },
      { organizationId: 'org', sku: '   ', barcode: null },
    )
    expect(conflicto).toBeNull()
    expect(consulta).not.toHaveBeenCalled()
  })

  /** Comas y paréntesis rompen el filtro `or` de PostgREST. */
  it('un SKU con comas no rompe la consulta', async () => {
    const { client, visto } = clienteCon([])
    await findProductConflict(client, { organizationId: 'org', sku: 'A,B(C)' })
    expect(visto.filtro).toBe('sku.eq.ABC')
  })

  it('si la consulta falla, no se hace de cuenta que no había conflicto', async () => {
    const { client } = clienteCon([], { message: 'timeout' })
    await expect(findProductConflict(client, { organizationId: 'org', sku: 'ABC' })).rejects.toThrow('timeout')
  })

  it('el mensaje dice qué código y de quién es', () => {
    expect(conflictMessage({ field: 'sku', value: 'ABC', name: 'Babyliss Pro', id: 'x' })).toContain('Babyliss Pro')
    expect(conflictMessage({ field: 'barcode', value: '200', name: 'Babyliss Pro', id: 'x' })).toContain('código de barras')
  })
})

/**
 * La edición desde el listado escribía `products.stock_quantity` directo. En
 * treinta días no hay un solo movimiento que haya llevado un stock a cero, y
 * sin embargo hay productos en cero: nadie podía saber quién los dejó así.
 */
describe('todo cambio de stock queda registrado', () => {
  function clienteDeMovimientos(error: { message: string } | null = null) {
    const filas: Record<string, unknown>[] = []
    const client = {
      from: () => ({
        insert: async (fila: Record<string, unknown>) => {
          filas.push(fila)
          return { error }
        },
      }),
    }
    return { client, filas }
  }

  it('guarda de cuánto a cuánto fue el stock', async () => {
    const { client, filas } = clienteDeMovimientos()
    const registrado = await recordStockAdjustment(client, {
      organizationId: 'org',
      productId: 'prod',
      branchId: 'suc',
      previousStock: 12,
      nextStock: 0,
      userId: 'user',
    })
    expect(registrado).toBe(true)
    expect(filas[0]).toMatchObject({
      organization_id: 'org',
      product_id: 'prod',
      branch_id: 'suc',
      movement_type: 'adjustment',
      quantity: 12,
      previous_stock: 12,
      new_stock: 0,
      user_id: 'user',
    })
  })

  it('la cantidad es positiva también cuando el stock sube', async () => {
    const { client, filas } = clienteDeMovimientos()
    await recordStockAdjustment(client, { organizationId: 'org', productId: 'prod', previousStock: 2, nextStock: 9 })
    expect(filas[0]).toMatchObject({ quantity: 7, previous_stock: 2, new_stock: 9 })
  })

  it('no anota nada si el stock no cambió', async () => {
    const { client, filas } = clienteDeMovimientos()
    const registrado = await recordStockAdjustment(client, {
      organizationId: 'org',
      productId: 'p',
      previousStock: 5,
      nextStock: 5,
    })
    expect(registrado).toBe(false)
    expect(filas).toHaveLength(0)
  })

  it('avisa si no pudo anotarlo', async () => {
    const { client } = clienteDeMovimientos({ message: 'rls' })
    await expect(
      recordStockAdjustment(client, { organizationId: 'org', productId: 'p', previousStock: 1, nextStock: 0 }),
    ).rejects.toThrow('rls')
  })
})

describe('la API de productos usa estas reglas', () => {
  const route = readFileSync(resolve(process.cwd(), 'src/app/api/products/route.ts'), 'utf8')

  it('crear y editar rechazan un código repetido con 409', () => {
    expect(route).toContain('conflictoAlCrear')
    expect(route).toContain('conflictoAlEditar')
    expect(route).toContain("code: 'DUPLICATE_CODE'")
    expect(route.match(/DUPLICATE_CODE/g) ?? []).toHaveLength(2)
  })

  it('editar el stock deja su movimiento', () => {
    expect(route).toContain('recordStockAdjustment')
  })
})
