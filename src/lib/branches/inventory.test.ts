import { describe, expect, it } from 'vitest'
import { formatBranchInventoryError } from './inventory'

describe('formatBranchInventoryError', () => {
  it('preserves Supabase error context for branch stock failures', () => {
    expect(formatBranchInventoryError({
      message: 'new row violates row-level security policy',
      code: '42501',
      details: 'Failing row contains branch stock data',
      hint: 'Check branch_inventory policies',
    })).toBe(
      'new row violates row-level security policy (42501) - Failing row contains branch stock data - Check branch_inventory policies'
    )
  })
})
