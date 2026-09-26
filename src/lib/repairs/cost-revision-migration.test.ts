import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260821013000_repair_cost_revisions.sql'),
  'utf8',
)

describe('repair cost revision migration', () => {
  it('creates tenant-scoped immutable revision records', () => {
    expect(sql).toContain('create table if not exists public.repair_cost_revisions')
    expect(sql).toContain('create table if not exists public.repair_cost_revision_parts')
    expect(sql).toContain('alter table public.repair_cost_revisions enable row level security')
    expect(sql).toContain('alter table public.repair_cost_revision_parts enable row level security')
    expect(sql).toContain('create trigger repair_cost_revisions_append_only')
    expect(sql).toContain('create trigger repair_cost_revision_parts_append_only')
  })

  it('locks the repair and keeps inventory plus history in one RPC', () => {
    expect(sql).toContain('create or replace function public.save_repair_cost_revision')
    expect(sql).toMatch(/from public\.repairs[\s\S]+for update/)
    expect(sql).toContain("raise exception 'REPAIR_DISCOUNT_LIMIT_EXCEEDED'")
    expect(sql).toContain("raise exception 'REPAIR_PART_BELOW_COST'")
    expect(sql).toContain("raise exception 'REPAIR_OVERRIDE_REASON_REQUIRED'")
    expect(sql).toContain("raise exception 'REPAIR_STOCK_CHANGED|%|%'")
    expect(sql).toContain('insert into public.repair_cost_revisions')
    expect(sql).toContain('insert into public.repair_cost_revision_parts')
    expect(sql).toContain('insert into public.product_movements')
  })

  it('stores tax and pricing policy snapshots', () => {
    expect(sql).toContain('repair_max_discount_percent')
    expect(sql).toContain('repair_labor_tax_rate')
    expect(sql).toContain('tax_breakdown')
    expect(sql).toContain('policy_snapshot')
    expect(sql).toContain('unit_cost_snapshot')
    expect(sql).toContain('unit_price_snapshot')
  })

  it('is idempotent and restricted to the backend service role', () => {
    expect(sql).toContain('unique (organization_id, idempotency_key)')
    expect(sql).toContain("raise exception 'REPAIR_COST_IDEMPOTENCY_CONFLICT'")
    expect(sql).toContain('revoke all on function public.save_repair_cost_revision')
    expect(sql).toContain('grant execute on function public.save_repair_cost_revision')
    expect(sql).toContain('to service_role')
  })

  it('grants only tenant-scoped reads through the Data API', () => {
    expect(sql).toContain('revoke all on table public.repair_cost_revisions from anon, authenticated')
    expect(sql).toContain('grant select on table public.repair_cost_revisions to authenticated')
    expect(sql).toContain('repair_cost_revisions_tenant_read')
    expect(sql).toContain('organization_members')
  })
})
