import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('contrato de variantes en ventas POS', () => {
  it('conserva producto padre y variante hasta el request server-side', () => {
    const root = process.cwd()
    const cart = readFileSync(resolve(root, 'src/app/dashboard/pos/hooks/useOptimizedCart.ts'), 'utf8')
    const processor = readFileSync(resolve(root, 'src/app/dashboard/pos/hooks/usePOSSaleProcessor.ts'), 'utf8')
    const products = readFileSync(resolve(root, 'src/hooks/usePOSProducts.ts'), 'utf8')
    const productVariants = readFileSync(resolve(root, 'src/hooks/useProductVariants.ts'), 'utf8')

    expect(cart).toContain('productId: cartItem.product_id')
    expect(cart).toContain('variantId: cartItem.variant_id')
    expect(processor).toContain('product_id: item.productId')
    expect(processor).toContain('variant_id: item.variantId')
    expect(products).toContain('product_id: item.product_id || item.id')
    expect(products).toContain('variant_id: item.variant_id || null')
    expect(productVariants).toContain('&active=true')
    expect(productVariants).toContain('normalizeVariantAttributeValues(variant.attributes)')
    const variantsRoute = readFileSync(resolve(root, 'src/app/api/variants/route.ts'), 'utf8')
    expect(variantsRoute).toContain('normalizeVariantAttributeValues(row.attributes)')
    expect(variantsRoute).toContain('has_variants: true')
    expect(variantsRoute).toContain('variant_attribute_config:')
    const route = readFileSync(resolve(root, 'src/app/api/pos/process-sale/route.ts'), 'utf8')
    const migration = readFileSync(resolve(root, 'supabase/migrations/20260908010913_pos_variant_sales_atomic.sql'), 'utf8')
    expect(route).toContain("rpc('process_pos_sale_atomic_v5'")
    expect(migration).toContain('adjust_variant_stock_atomic')
    expect(migration).toContain('variant_id,variant_name,variant_sku,variant_attributes')
  })

  it('valida el stock propio de la variante', () => {
    const cart = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/hooks/useOptimizedCart.ts'), 'utf8')
    expect(cart).toContain('currentCartItem?.variantId && quantity > availableStock')
  })
})
