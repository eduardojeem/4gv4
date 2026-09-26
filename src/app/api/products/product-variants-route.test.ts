import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { productSchema } from '@/lib/validation/schemas'

const routeSource = readFileSync(resolve(process.cwd(), 'src/app/api/products/route.ts'), 'utf8')
const itemRouteSource = readFileSync(resolve(process.cwd(), 'src/app/api/products/[id]/route.ts'), 'utf8')
const productsHookSource = readFileSync(resolve(process.cwd(), 'src/hooks/useProductsSupabase.ts'), 'utf8')

const validProduct = {
  name: 'Remera clásica',
  sku: 'REM-BASE',
  purchase_price: 50_000,
  sale_price: 90_000,
  stock_quantity: 0,
  min_stock: 0,
  has_variants: true,
  variant_attribute_config: [],
  variants: [],
}

describe('product variants API contract', () => {
  it('rejects a variant product without attributes and variants', () => {
    const parsed = productSchema.safeParse(validProduct)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['variant_attribute_config', 'variants']),
      )
    }
  })

  it('uses the authenticated tenant and actor for the variant save RPC', () => {
    expect(routeSource).toContain(".rpc('save_product_with_variants'")
    expect(routeSource).toContain('organization_id: organization.id')
    expect(routeSource).toContain('p_actor_id: user.id')
    expect(routeSource).toContain('p_branch_id: variantBranchId')
  })

  it('maps stable duplicate and stock errors to conflict responses', () => {
    expect(routeSource).toContain('VARIANT_SKU_DUPLICATE')
    expect(routeSource).toContain('VARIANT_BARCODE_DUPLICATE')
    expect(routeSource).toContain('VARIANT_STOCK_INSUFFICIENT')
  })

  it('loads variants in the authenticated product detail used by edit forms', () => {
    expect(itemRouteSource).toContain('variants:product_variants(*)')
  })

  it('updates modal products through the variant-aware collection endpoint', () => {
    expect(productsHookSource).toContain("fetch('/api/products', {")
    expect(productsHookSource).toContain('body: JSON.stringify({ ...productData, id })')
  })
})
