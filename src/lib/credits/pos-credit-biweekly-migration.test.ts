import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('POS biweekly installment migration', () => {
  it('updates the persisted POS schedule from 14 to 15 calendar days', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260822004143_align_pos_biweekly_credit_to_fifteen_days.sql'),
      'utf8',
    )

    expect(migration).toContain("'make_interval(days => 14 * installment_index)'")
    expect(migration).toContain("'make_interval(days => 15 * installment_index)'")
    expect(migration).toContain('if updated_definition = current_definition then')
  })
})
