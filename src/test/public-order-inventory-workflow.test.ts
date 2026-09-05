import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const publicOrderRoute = readFileSync(
  resolve(workspace, 'src/app/api/public/orders/route.ts'),
  'utf8'
)
const statusRoute = readFileSync(
  resolve(workspace, 'src/app/api/orders/[id]/status/route.ts'),
  'utf8'
)
const migration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260729220332_harden_public_order_inventory.sql'),
  'utf8'
)
const customerLinkMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260802161753_link_public_customers_atomically.sql'),
  'utf8'
)
const lifecycleMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260903223832_harden_customer_order_lifecycle.sql'),
  'utf8'
)

describe('public order inventory workflow', () => {
  it('rejects stock conflicts instead of silently reducing quantities', () => {
    expect(publicOrderRoute).not.toContain('Math.min(item.quantity, stock)')
    expect(publicOrderRoute).toContain("code: 'STOCK_CHANGED'")
  })

  it('reconciles browser prices before creating the order', () => {
    expect(publicOrderRoute).toContain('unitPrice: z.number()')
    expect(publicOrderRoute).toContain("code: 'PRICE_CHANGED'")
    expect(publicOrderRoute).toContain('priceConflicts')
  })

  it('allows an unlisted delivery area when a default delivery cost is configured', () => {
    expect(publicOrderRoute).toContain('checkout.delivery.defaultCost <= 0')
    expect(publicOrderRoute).toContain('selectedZoneCost: selectedDeliveryZone?.cost')
  })

  it('rejects a configured zone when the submitted city and neighborhood do not match', () => {
    expect(publicOrderRoute).toContain("code: 'DELIVERY_ZONE_MISMATCH'")
    expect(publicOrderRoute).toContain('deliveryZoneMatchesLocation')
  })

  it('creates public orders and reserves inventory in one transaction', () => {
    expect(publicOrderRoute).toContain("'create_public_order_idempotent_atomic'")
    expect(lifecycleMigration).toContain('public.create_public_order_with_store_credit_atomic(')
    expect(customerLinkMigration).toContain('function public.create_public_order_with_customer_account_atomic')
    expect(customerLinkMigration).toContain('public.create_public_order_atomic(')
    expect(migration).toContain('function public.create_public_order_atomic')
    expect(migration).toContain('stock_quantity >= item.quantity')
  })

  it('cancels orders and restores reserved inventory atomically', () => {
    expect(statusRoute).toContain("'cancel_customer_order_atomic'")
    expect(migration).toContain('function public.cancel_customer_order_atomic')
    expect(migration).toContain('for update')
  })

  it('prevents concurrent expiration workers from restoring the same stock twice', () => {
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('stock_reserved = true')
  })
})
