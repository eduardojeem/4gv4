import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260816190000_public_order_store_credit_reservations.sql'
)

describe('public order store-credit reservation contract', () => {
  it('models one auditable reservation per order', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('create table if not exists public.customer_store_credit_reservations')
    expect(sql).toContain("status text not null default 'reserved'")
    expect(sql).toContain("check (status in ('reserved', 'consumed', 'released'))")
    expect(sql).toContain('unique (organization_id, order_id)')
    expect(sql).toContain('store_credit_reserved')
    expect(sql).toContain('store_credit_applied')
  })

  it('serializes balance reservations and derives available balance', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('create_public_order_with_store_credit_atomic')
    expect(sql).toContain('for update')
    expect(sql).toContain('ledger_balance - reserved_balance')
    expect(sql).toContain('store_credit_exceeds_available')
    expect(sql).toContain('store_credit_profile_required')
  })

  it('consumes on confirmation and releases on cancellation or expiry', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('confirm_customer_order_store_credit_atomic')
    expect(sql).toContain("source_type = 'order'")
    expect(sql).toContain("status = 'consumed'")
    expect(sql).toContain("status = 'released'")
    expect(sql).toContain('cancel_customer_order_atomic')
    expect(sql).toContain('expire_stale_orders')
  })

  it('restricts privileged functions to the service role', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('revoke all on function public.create_public_order_with_store_credit_atomic')
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('to service_role')
  })
})
