import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913153000_repair_quality_checks.sql'),
  'utf8',
)

describe('repair quality check migration', () => {
  it('keeps the verification history immutable for authenticated users', () => {
    expect(migration).toContain('alter table public.repair_quality_checks enable row level security')
    expect(migration).toContain('revoke insert, update, delete on table public.repair_quality_checks from authenticated')
    expect(migration).toContain('grant select on table public.repair_quality_checks to authenticated')
  })

  it('locks and scopes the repair before recording the result', () => {
    expect(migration).toMatch(/where id = p_repair_id\s+and organization_id = p_organization_id\s+and branch_id = p_branch_id\s+for update/)
    expect(migration).toContain("if target_repair.status in ('entregado', 'cancelado')")
    expect(migration).toContain('if target_repair.technician_id is null')
  })

  it('separates cashier delivery from technical management', () => {
    const cashierBlock = migration.match(/if member_role = 'cashier' then([\s\S]*?)\n  end if;/)?.[1]
    expect(cashierBlock).toContain("'repairs.orders.read'")
    expect(cashierBlock).toContain("'repairs.orders.deliver'")
    expect(cashierBlock).not.toContain("'repairs.orders.update'")
  })
})
