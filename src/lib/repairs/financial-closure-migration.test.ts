import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814235814_repair_financial_closure.sql'),
  'utf8',
)

describe('repair financial closure migration', () => {
  it('creates an immutable tenant-scoped payment ledger', () => {
    expect(migration).toContain('create table if not exists public.repair_payments')
    expect(migration).toContain('unique (organization_id, idempotency_key)')
    expect(migration).toContain('alter table public.repair_payments enable row level security')
    expect(migration).toContain('revoke insert, update, delete on public.repair_payments from anon, authenticated')
  })

  it('locks the repair and keeps the financial write inside one RPC', () => {
    expect(migration).toContain('create or replace function public.close_repair_and_register_payment')
    expect(migration).toMatch(/from public\.repairs[\s\S]+for update/)
    expect(migration).toContain('insert into public.repair_payments')
    expect(migration).toContain('insert into public.cash_movements')
    expect(migration).toContain("set search_path = ''")
  })

  it('restricts execution to the backend service role', () => {
    expect(migration).toMatch(/revoke all on function public\.close_repair_and_register_payment[\s\S]+from public/)
    expect(migration).toMatch(/grant execute on function public\.close_repair_and_register_payment[\s\S]+to service_role/)
  })
})
