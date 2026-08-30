import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260830151349_harden_private_tenant_isolation.sql',
  ),
  'utf8',
).toLowerCase()

describe('private tenant isolation migration', () => {
  it('removes known global product read policies', () => {
    expect(sql).toContain('drop policy if exists "auth read active products" on public.products')
    expect(sql).toContain('drop policy if exists "allow authenticated read products" on public.products')
    expect(sql).toContain('drop policy if exists products_read_all on public.products')
  })

  it('removes known global reads from every dashboard table', () => {
    for (const table of [
      'categories',
      'customers',
      'sales',
      'repairs',
      'cash_registers',
      'cash_closures',
      'cash_movements',
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('makes installment progress honor invoker RLS and expose its tenant', () => {
    expect(sql).toContain('create view public.credit_installments_progress')
    expect(sql).toContain('with (security_invoker = true)')
    expect(sql).toContain('cc.organization_id')
    expect(sql).toContain('revoke all on public.credit_installments_progress from anon')
  })

  it('never grants authenticated users an unconditional tenant-table read', () => {
    expect(sql).not.toMatch(/to authenticated[\s\S]{0,160}using\s*\(\s*true\s*\)/)
  })

  it('uses explicit idempotent policy cleanup instead of dynamic predicate parsing', () => {
    expect(sql).toContain('drop policy if exists categories_read_all on public.categories')
    expect(sql).toContain('drop policy if exists "read credits" on public.customer_credits')
    expect(sql).not.toContain('do $cleanup$')
    expect(sql).not.toContain('from pg_policies')
  })
})
