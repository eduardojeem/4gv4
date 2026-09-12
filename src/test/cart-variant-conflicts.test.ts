import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { findVariantConflicts } from '@/lib/orders/variant-conflicts'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const productos = new Map([
  ['p1', { name: 'Remera Básica', has_variants: true }],
  ['p2', { name: 'Gorra', has_variants: false }],
])

const variantes = new Map([
  ['v1', { product_id: 'p1' }],
  ['v9', { product_id: 'otro' }],
])

/**
 * El pedido rechazaba el carrito entero con un error generico: el cliente leia
 * «Elegí nuevamente la variante» sin saber cual de los productos arreglar.
 */
describe('las líneas del carrito que no se pueden comprar', () => {
  it('una línea sin variante de un producto que sí las tiene', () => {
    expect(findVariantConflicts([{ productId: 'p1', variantId: null }], productos, variantes)).toEqual([
      { productId: 'p1', variantId: null, productName: 'Remera Básica', reason: 'MISSING_VARIANT' },
    ])
  })

  it('una variante que ya no existe o es de otro producto', () => {
    expect(findVariantConflicts([{ productId: 'p1', variantId: 'borrada' }], productos, variantes)).toMatchObject([
      { productId: 'p1', reason: 'UNKNOWN_VARIANT' },
    ])
    expect(findVariantConflicts([{ productId: 'p1', variantId: 'v9' }], productos, variantes)).toMatchObject([
      { productId: 'p1', variantId: 'v9', reason: 'UNKNOWN_VARIANT' },
    ])
  })

  it('lo que está bien no se reporta', () => {
    expect(findVariantConflicts([
      { productId: 'p1', variantId: 'v1' },
      { productId: 'p2', variantId: null },
    ], productos, variantes)).toEqual([])
  })

  it('devuelve una entrada por línea, con el nombre para poder avisar', () => {
    const conflictos = findVariantConflicts([
      { productId: 'p1', variantId: null },
      { productId: 'p2', variantId: null },
      { productId: 'p1', variantId: 'borrada' },
    ], productos, variantes)

    expect(conflictos.map((c) => c.productName)).toEqual(['Remera Básica', 'Remera Básica'])
  })

  it('un producto que ya no está lo resuelve otra validación, no esta', () => {
    expect(findVariantConflicts([{ productId: 'fantasma', variantId: null }], productos, variantes)).toEqual([])
  })
})

describe('el pedido y el carrito se entienden', () => {
  it('el pedido devuelve cuáles son las líneas con problema', () => {
    const ruta = leer('src/app/api/public/orders/route.ts')
    expect(ruta).toContain('const variantConflicts = findVariantConflicts(requestedItems, productMap, variantMap)')
    expect(ruta).toContain("code: 'VARIANT_NOT_AVAILABLE'")
    expect(ruta).toContain('data: { conflicts: variantConflicts }')
  })

  it('el carrito las saca y dice qué hacer, en vez de un error genérico', () => {
    const carrito = leer('src/components/public/cart/CartPageClient.tsx')
    expect(carrito).toContain("payload?.code === 'VARIANT_NOT_AVAILABLE'")
    expect(carrito).toContain('removeItem(cartItemId)')
    expect(carrito).toContain('elegí talle o color en la página del producto')
  })
})
