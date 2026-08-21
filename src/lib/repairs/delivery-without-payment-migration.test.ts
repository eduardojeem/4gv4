import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('delivery without payment migration', () => {
  it('routes a null payment method through the non-credit closure path', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '20260821002838_fix_delivery_without_payment_credit_branch.sql'),
      'utf8'
    ).toLowerCase()

    expect(migration).toContain("p_payment_method is distinct from ''credit''")
    expect(migration).toContain('execute replace(function_definition, old_condition, new_condition)')
  })
})
