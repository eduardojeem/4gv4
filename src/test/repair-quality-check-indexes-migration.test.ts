import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913200735_add_repair_quality_check_fk_indexes.sql'),
  'utf8',
)

describe('repair quality check foreign-key indexes migration', () => {
  it('indexes the branch and author relationships idempotently', () => {
    expect(migration).toContain('create index if not exists repair_quality_checks_branch_id_idx')
    expect(migration).toContain('on public.repair_quality_checks (branch_id)')
    expect(migration).toContain('create index if not exists repair_quality_checks_created_by_idx')
    expect(migration).toContain('on public.repair_quality_checks (created_by)')
  })
})
