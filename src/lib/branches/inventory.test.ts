import { describe, expect, it } from 'vitest'
import { applyBranchInventoryToProducts, formatBranchInventoryError } from './inventory'

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

  it('treats products without rows as zero stock in a selected branch', () => {
    const products = applyBranchInventoryToProducts(
      [
        { id: 'product-1', stock_quantity: 12 },
        { id: 'product-2', stock_quantity: 7 },
      ],
      new Map(),
      true
    )

    expect(products).toEqual([
      { id: 'product-1', stock_quantity: 0, branch_stock_quantity: 0 },
      { id: 'product-2', stock_quantity: 0, branch_stock_quantity: 0 },
    ])
  })
})
