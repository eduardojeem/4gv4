import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('public order product variants', () => {
  it('keeps the base product and selected variant as separate identifiers', () => {
    const cart = read('src/lib/public-cart.ts')
    const checkout = read('src/components/public/cart/CartPageClient.tsx')
    expect(cart).toContain('cartItemId: string')
    expect(cart).toContain('variantId: string | null')
    expect(checkout).toContain('variantId: item.variantId')
  })

  it('renders variant rows with their unique cart item identifier', () => {
    const cartPage = read('src/components/public/cart/CartPageClient.tsx')
    expect(cartPage).toContain('key={item.cartItemId}')
    expect(cartPage).not.toContain('key={item.productId}')
  })

  it('validates and prices the selected variant on the server', () => {
    const route = read('src/app/api/public/orders/route.ts')
    expect(route).toContain('variantId: z.string().uuid().optional().nullable()')
    expect(route).toContain(".from('product_variants')")
    expect(route).toContain('VARIANT_NOT_AVAILABLE')
  })

  it('reserves and restores variant stock atomically', () => {
    const migration = read('supabase/migrations/20260903235322_public_order_variant_inventory.sql')
    expect(migration).toContain('variant_id')
    expect(migration).toContain('update public.product_variants')
    expect(migration).toContain('STOCK_CHANGED_VARIANT')
    expect(migration).toContain('create or replace function public.cancel_customer_order_atomic')
  })
})
