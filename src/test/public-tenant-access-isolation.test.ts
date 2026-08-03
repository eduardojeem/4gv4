import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('public tenant access isolation', () => {
  it('does not infer wholesale pricing from global dashboard permissions', () => {
    const productCard = read('src/components/public/ProductCard.tsx')

    expect(productCard).not.toContain('WHOLESALE_PRICE_PERMISSION')
    expect(productCard).not.toContain('useAuth()')
    expect(productCard).toContain(
      'props.isWholesale ?? product.wholesale_price != null'
    )
  })

  it('resolves wholesale access inside the current organization', () => {
    const wholesaleAccess = read('src/lib/auth/wholesale-access.ts')
    const productsRoute = read('src/app/api/public/products/route.ts')

    expect(wholesaleAccess).toContain('organizationId: string')
    expect(wholesaleAccess).toContain(".eq('organization_id', organizationId)")
    expect(productsRoute).toContain('organizationId: organization.id')
    expect(productsRoute).toContain("response.headers.set('Vary', 'Cookie')")
  })

  it('loads repair notifications through a tenant-aware API', () => {
    const notifications = read('src/components/public/PublicRepairReadyNotifications.tsx')
    const route = read('src/app/api/public/repair-notifications/route.ts')

    expect(notifications).toContain('/api/public/repair-notifications')
    expect(notifications).not.toContain(".from('customers')")
    expect(notifications).not.toContain(".from('repairs')")
    expect(notifications).not.toContain('.channel(')

    expect(route).toContain('resolvePublicStorefrontOrganization(request, admin)')
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain(".eq('profile_id', user.id)")
    expect(route).toContain(".eq('customer_id', customer.id)")
  })

  it('scopes wholesale grants and prevents new cross-organization repair links', () => {
    const migration = read(
      'supabase/migrations/20260802173000_scope_public_customer_access.sql'
    )

    expect(migration).toContain('add column if not exists organization_id uuid')
    expect(migration).toContain("permission = 'products.read_wholesale_prices'")
    expect(migration).toContain('foreign key (customer_id, organization_id)')
    expect(migration).toContain('not valid')
  })
})
