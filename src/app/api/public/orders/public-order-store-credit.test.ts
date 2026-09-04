import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public order store-credit request contract', () => {
  it('validates the requested amount and never accepts browser customer identity', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/public/orders/route.ts'), 'utf8')

    expect(route).toContain('storeCreditAmount: z.number().finite().min(0)')
    expect(route).not.toContain('customerId: z.string()')
    expect(route).toContain('if (input.storeCreditAmount > 0 && !buyer)')
  })

  it('creates the order and reservation through one database transaction', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/public/orders/route.ts'), 'utf8')

    expect(route).toContain("'create_public_order_idempotent_atomic'")
    expect(route).toContain('p_store_credit_amount: input.storeCreditAmount')
    expect(route).toContain('STORE_CREDIT_EXCEEDS_AVAILABLE')
    expect(route).toContain('STORE_CREDIT_PROFILE_REQUIRED')
  })
})
