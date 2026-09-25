import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationName = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .find((name) => name.endsWith('_harden_pos_repair_payment_ledger.sql'))

const sql = migrationName
  ? readFileSync(resolve(process.cwd(), 'supabase/migrations', migrationName), 'utf8')
  : ''

describe('POS repair payment ledger migration', () => {
  it('stores an idempotent payment breakdown linked to the sale and repair', () => {
    expect(migrationName).toBeTruthy()
    expect(sql).toContain('add column if not exists payment_breakdown jsonb')
    expect(sql).toContain('add column if not exists immediate_amount numeric')
    expect(sql).toContain('add column if not exists financed_amount numeric')
    expect(sql).toContain("'pos:' || allocation.resolved_sale_id::text || ':' || allocation.repair_id::text")
    expect(sql).toContain('on conflict (organization_id, idempotency_key) do nothing')
    expect(sql).toContain('join public.sale_payments')
  })

  it('caps immediate and financed allocations at the repair payment delta', () => {
    expect(sql).toMatch(/least\(\s*allocation\.payment_delta,\s*greatest\(0, allocation\.sale_immediate - allocation\.prior_repair_delta\)\s*\)/)
    expect(sql).toContain('allocation.payment_delta - resolved_immediate')
    expect(sql).toContain('resolved_immediate + resolved_financed <> allocation.payment_delta')
    expect(sql).toContain('source, sale_id, created_by')
  })

  it('keeps the trigger private and schema-qualified', () => {
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('revoke all on function public.capture_pos_repair_payment() from public, anon, authenticated')
    expect(sql).toContain('grant execute on function public.capture_pos_repair_payment() to service_role')
  })
})
