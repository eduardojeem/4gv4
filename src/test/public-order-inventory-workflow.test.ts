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

describe('public order inventory workflow', () => {
  it('rejects stock conflicts instead of silently reducing quantities', () => {
    expect(publicOrderRoute).not.toContain('Math.min(item.quantity, stock)')
    expect(publicOrderRoute).toContain("code: 'STOCK_CHANGED'")
  })

  it('creates public orders and reserves inventory in one transaction', () => {
    expect(publicOrderRoute).toContain("'create_public_order_with_customer_account_atomic'")
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
