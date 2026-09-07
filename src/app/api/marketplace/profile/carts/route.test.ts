import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/marketplace/profile/carts/route.ts'), 'utf8')

describe('marketplace profile cart API security contract', () => {
  it('requires an authenticated user on every operation', () => {
    expect(route.match(/if \(!user\).*401/g)).toHaveLength(3)
  })

  it('resolves the public organization and scopes catalog queries', () => {
    expect(route).toContain('resolvePublicStorefrontOrganizationBySlug')
    expect(route.match(/\.eq\('organization_id', organization\.id\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('does not persist browser supplied prices', () => {
    expect(route).toContain('Number(product.offer_price)')
    expect(route).toContain('Number(product.sale_price ?? 0)')
    expect(route).toContain("observed_unit_price: item.unitPrice")
    expect(route).not.toContain('parsed.data.unitPrice')
  })

  it('reports unavailable products and adjusted quantities', () => {
    expect(route).toContain("reason: 'unavailable'")
    expect(route).toContain("reason: 'quantity_adjusted'")
    expect(route).toContain('Math.min(item.quantity, stock)')
  })
})
