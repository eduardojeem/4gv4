import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('organization module consistency', () => {
  it('binds orders navigation, page and API routes to the orders module', () => {
    expect(read('src/components/dashboard/sidebar.tsx')).toContain("href: '/dashboard/orders', icon: ShoppingBag, permission: 'orders.read', requiredModule: 'orders'")
    expect(read('src/components/dashboard/mobile-nav.tsx')).toContain("href: '/dashboard/orders', icon: ShoppingBag, requiredModule: 'orders'")
    expect(read('src/app/dashboard/orders/layout.tsx')).toContain('<OrganizationModuleGate module="orders">')

    const routes = [
      'src/app/api/orders/route.ts',
      'src/app/api/orders/[id]/route.ts',
      'src/app/api/orders/[id]/history/route.ts',
      'src/app/api/orders/[id]/payment/route.ts',
      'src/app/api/orders/[id]/status/route.ts',
    ]
    for (const route of routes) expect(read(route)).toContain("module: 'orders'")
  })

  it('conditions dashboard order and service summaries on effective modules', () => {
    const dashboard = read('src/app/dashboard/page.tsx')
    expect(dashboard).toContain("const hasOrders = effectiveModules.includes('orders')")
    expect(dashboard).toContain("const hasServices = effectiveModules.includes('services')")
    expect(dashboard).toContain('hasOrders ? withBranchFilter(')
  })

  it('only offers and accepts delivery when the delivery module is active', () => {
    const dialog = read('src/components/dashboard/orders/CreateOrderDialog.tsx')
    const route = read('src/app/api/orders/route.ts')
    expect(dialog).toContain("effectiveModules.includes('delivery')")
    expect(dialog).toContain('availableFulfillmentOptions')
    expect(route).toContain("effectiveModules.includes('delivery')")
    expect(route).toContain('DELIVERY_MODULE_DISABLED')
  })
})
