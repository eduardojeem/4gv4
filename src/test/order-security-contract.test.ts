import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const publicCreate = read('src/app/api/public/orders/route.ts')
const publicTrack = read('src/app/api/public/orders/track/route.ts')
const myOrders = read('src/app/api/public/orders/me/route.ts')
const payment = read('src/app/api/orders/[id]/payment/route.ts')
const update = read('src/app/api/orders/[id]/route.ts')

describe('order security contracts', () => {
  it('awaits public rate limits', () => {
    expect(publicCreate).toContain('const allowed = await rateLimiter.check(')
    expect(publicTrack).toContain('const allowed = await rateLimiter.check(')
  })

  it('matches verified contacts exactly', () => {
    expect(publicTrack).toContain("query = query.eq('customer_email', customerEmail)")
    expect(publicTrack).not.toContain("query.ilike('customer_email'")
    expect(myOrders).toContain('email.eq.')
    expect(myOrders).not.toContain('phone.eq.')
  })

  it('delegates payments to the atomic accounting operation', () => {
    expect(payment).toContain("'record_customer_order_collection_atomic'")
    expect(payment).toContain('collectionAmount')
    expect(payment).toContain('idempotencyKey')
    expect(payment).not.toContain(".from('customer_orders')\n      .update")
  })

  it('keeps collections auditable and idempotent in SQL', () => {
    const migration = read('supabase/migrations/20260903232904_record_customer_order_collections.sql')
    expect(migration).toContain('payment_reference')
    expect(migration).toContain('idempotency_key')
    expect(migration).toContain('record_customer_order_collection_atomic')
    expect(migration).toContain('PAYMENT_EXCEEDS_AMOUNT_DUE')
  })

  it('requires an idempotency key for public checkout', () => {
    expect(publicCreate).toContain('checkoutAttemptId: z.string().uuid()')
    expect(publicCreate).toContain("'create_public_order_idempotent_atomic'")
  })

  it('prevents financial edits after a payment or terminal state', () => {
    expect(update).toContain('ORDER_FINANCIAL_EDIT_LOCKED')
  })
})
