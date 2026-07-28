import { describe, expect, it, vi } from 'vitest'
import { reserveOrderStock } from '@/lib/orders/stock'

describe('order stock reservations', () => {
  it('uses branch inventory when an active branch is provided', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })

    const result = await reserveOrderStock(
      { rpc },
      'org-1',
      [{ product_id: 'product-1', product_name: 'Equipo', quantity: 2 }],
      'branch-1'
    )

    expect(result.success).toBe(true)
    expect(rpc).toHaveBeenCalledWith('decrement_branch_order_stock', {
      p_product_id: 'product-1',
      p_organization_id: 'org-1',
      p_branch_id: 'branch-1',
      p_quantity: 2,
    })
  })

  it('keeps the global stock contract for orders without a branch', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })

    await reserveOrderStock(
      { rpc },
      'org-1',
      [{ product_id: 'product-1', quantity: 1 }]
    )

    expect(rpc).toHaveBeenCalledWith('decrement_product_stock', {
      p_product_id: 'product-1',
      p_organization_id: 'org-1',
      p_quantity: 1,
    })
  })
})
