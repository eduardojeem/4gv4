import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('customer type database contract', () => {
  it('accepts the wholesale value emitted by customer forms', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '20260821002346_allow_wholesale_customer_type.sql'),
      'utf8'
    ).toLowerCase()

    expect(migration).toContain("'wholesale'")
    expect(migration).toContain('customers_customer_type_check')
  })
})
