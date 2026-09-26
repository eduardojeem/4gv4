import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolvePublicVariantPrice } from '@/lib/public/offer-pricing'
import { planVariantStockAdjustments } from '@/lib/products/variant-stock-sync'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/** Producto de 240.000 en oferta a 219.000: un 8,75% menos. */
const campera = { sale_price: 240_000, offer_price: 219_000, has_offer: true, wholesale_price: null }

describe('el precio público de una variante', () => {
  it('aplica el porcentaje de la oferta, no el precio del producto base', () => {
    // Antes la tarjeta mostraba 237.250 y el checkout cobraba 219.000.
    expect(resolvePublicVariantPrice({ isWholesale: false, product: campera, variant: { sale_price: 260_000 } })).toBe(237_250)
    expect(resolvePublicVariantPrice({ isWholesale: false, product: campera, variant: { sale_price: 200_000 } })).toBe(182_500)
  })

  it('si la variante vale lo mismo que el producto, es el precio de oferta', () => {
    expect(resolvePublicVariantPrice({ isWholesale: false, product: campera, variant: { sale_price: 240_000 } })).toBe(219_000)
  })

  it('sin variante devuelve el precio del producto', () => {
    expect(resolvePublicVariantPrice({ isWholesale: false, product: campera, variant: null })).toBe(219_000)
    expect(resolvePublicVariantPrice({ isWholesale: false, product: { sale_price: 240_000 } })).toBe(240_000)
  })

  it('una oferta apagada no descuenta, aunque haya quedado el precio cargado', () => {
    const apagada = { ...campera, has_offer: false }
    expect(resolvePublicVariantPrice({ isWholesale: false, product: apagada, variant: { sale_price: 260_000 } })).toBe(260_000)
    expect(resolvePublicVariantPrice({ isWholesale: false, product: apagada, variant: null })).toBe(240_000)
  })

  it('el precio mayorista gana sobre la oferta', () => {
    expect(resolvePublicVariantPrice({
      isWholesale: true,
      product: { ...campera, wholesale_price: 180_000 },
      variant: { sale_price: 260_000, wholesale_price: 190_000 },
    })).toBe(190_000)

    // Si la variante no tiene mayorista, se usa el del producto.
    expect(resolvePublicVariantPrice({
      isWholesale: true,
      product: { ...campera, wholesale_price: 180_000 },
      variant: { sale_price: 260_000 },
    })).toBe(180_000)
  })

  it('si la variante trae su propio precio de oferta, ese manda', () => {
    expect(resolvePublicVariantPrice({
      isWholesale: false,
      product: campera,
      variant: { sale_price: 260_000, offer_price: 199_000 },
    })).toBe(199_000)
  })

  it('nunca sube el precio: una oferta inválida se ignora', () => {
    const invalida = { sale_price: 240_000, offer_price: 300_000, has_offer: true }
    expect(resolvePublicVariantPrice({ isWholesale: false, product: invalida, variant: { sale_price: 260_000 } })).toBe(260_000)
  })
})

describe('la vitrina, el detalle y el cobro usan la misma regla', () => {
  const consumidores = [
    'src/components/public/ProductCard.tsx',
    'src/components/public/MarketplaceProductModal.tsx',
    'src/components/public/offers/OfferDetailModal.tsx',
    'src/app/(public)/productos/[id]/client-components.tsx',
    'src/app/api/public/orders/route.ts',
  ]

  it.each(consumidores)('%s calcula el precio con el helper compartido', (ruta) => {
    const fuente = leer(ruta)
    expect(fuente).toContain('resolvePublicVariantPrice')
    // Ya nadie arma el descuento por su cuenta.
    expect(fuente).not.toContain('resolveOfferPrice(')
  })

  it('el pedido ya no usa la regla que ignoraba el precio de la variante', () => {
    expect(leer('src/app/api/public/orders/route.ts')).not.toContain('resolvePublicUnitPrice')
  })
})

describe('el stock que se edita en una variante existente', () => {
  const ahora = new Date('2026-09-12T03:20:45.000Z')
  const actual = new Map([['v1', 10], ['v2', 4]])

  it('sin cambios no genera ningún movimiento', () => {
    expect(planVariantStockAdjustments(actual, [
      { id: 'v1', name: 'M Negro', stockQuantity: 10 },
      { id: 'v2', name: 'L Negro', stockQuantity: 4 },
    ], ahora)).toEqual([])
  })

  it('calcula la diferencia para subir y para bajar', () => {
    const ajustes = planVariantStockAdjustments(actual, [
      { id: 'v1', name: 'M Negro', stockQuantity: 14 },
      { id: 'v2', name: 'L Negro', stockQuantity: 1 },
    ], ahora)

    expect(ajustes.map((a) => [a.variantId, a.from, a.to, a.delta])).toEqual([
      ['v1', 10, 14, 4],
      ['v2', 4, 1, -3],
    ])
  })

  it('las variantes nuevas no se ajustan: su stock lo carga el guardado', () => {
    expect(planVariantStockAdjustments(actual, [
      { name: 'XL Negro', stockQuantity: 7 },
      { id: 'v9', name: 'S Negro', stockQuantity: 3 },
    ], ahora)).toEqual([])
  })

  it('repetir el mismo guardado no duplica el ajuste, pero otro cambio sí es nuevo', () => {
    const [primero] = planVariantStockAdjustments(actual, [{ id: 'v1', name: 'M', stockQuantity: 14 }], ahora)
    const [repetido] = planVariantStockAdjustments(actual, [{ id: 'v1', name: 'M', stockQuantity: 14 }], new Date('2026-09-12T03:20:59.000Z'))
    const [otro] = planVariantStockAdjustments(actual, [{ id: 'v1', name: 'M', stockQuantity: 15 }], ahora)

    expect(repetido.idempotencyKey).toBe(primero.idempotencyKey)
    expect(otro.idempotencyKey).not.toBe(primero.idempotencyKey)
  })

  it('el guardado aplica esos ajustes como movimiento trazable', () => {
    const ruta = leer('src/app/api/products/route.ts')
    expect(ruta).toContain('planVariantStockAdjustments(currentStockById, variantPayload.data.variants)')
    expect(ruta).toContain("p_movement_type: 'adjustment'")
    expect(ruta).toContain("p_reason: 'Ajuste de stock desde la ficha del producto'")
    // Si el ajuste falla, el usuario se entera.
    expect(ruta).toContain('stockWarnings.push(')
    expect(leer('src/hooks/useProductsSupabase.ts')).toContain('toast.warning(warning)')
  })
})

describe('guardar variantes desde cualquier pantalla', () => {
  it('Admin → Inventario guarda por la ruta que sí las persiste', () => {
    const hook = leer('src/hooks/use-inventory.ts')
    expect(hook).toContain("const response = await fetch('/api/products', {")
    expect(hook).toContain("JSON.stringify({ ...toProductApiPayload(productData), id })")
    for (const campo of ["'has_variants'", "'variant_attribute_config'", "'variants'"]) {
      expect(hook).toContain(campo)
    }
  })

  it('la ruta por id avisa en vez de descartar las variantes en silencio', () => {
    const ruta = leer('src/app/api/products/[id]/route.ts')
    expect(ruta).toContain("code: 'VARIANTS_NOT_SUPPORTED_HERE'")
    expect(ruta).toContain('const sendsVariants =')
  })
})
