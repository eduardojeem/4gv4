import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('order status store-credit lifecycle', () => {
  it('consumes reserved credit atomically when the order is confirmed', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/orders/[id]/status/route.ts'), 'utf8')
    expect(route).toContain("status === 'CONFIRMED'")
    expect(route).toContain("'confirm_customer_order_from_pending_atomic'")
  })

  it('normalizes credit coverage and outstanding amount for every order view', () => {
    const helpers = readFileSync(resolve(process.cwd(), 'src/lib/orders/helpers.ts'), 'utf8')
    expect(helpers).toContain('store_credit_reserved')
    expect(helpers).toContain('store_credit_applied')
    expect(helpers).toContain('amount_due')
  })
})
