import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyVariantBranchStock, loadVariantBranchStock } from './variant-branch-stock'
import { planVariantStockAdjustments } from './variant-stock-sync'
it('calculates the delta from selected branch stock, never the aggregate', async () => {
  const inQuery = vi.fn().mockResolvedValue({ data: [{ variant_id: 'v', stock_quantity: 3 }], error: null })
  const eq = vi.fn().mockReturnThis()
  const query = { select: vi.fn().mockReturnThis(), eq, in: inQuery }
  const from = vi.fn().mockReturnValue(query)
  const stocks = await loadVariantBranchStock({ from } as never, 'org', 'branch', ['v'])
  expect(from).toHaveBeenCalledWith('branch_variant_inventory')
  expect(eq).toHaveBeenCalledWith('organization_id', 'org')
  expect(eq).toHaveBeenCalledWith('branch_id', 'branch')
  expect(inQuery).toHaveBeenCalledWith('variant_id', ['v'])
  // Global stock could be 8, but branch stock is 3: target 10 needs +7, not +2.
  const adjustments = planVariantStockAdjustments(stocks, [{ id: 'v', stockQuantity: 10 }] as never)
  expect(adjustments[0].delta).toBe(7)
})
it('fails closed on an inventory read error', async () => {
  const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
  await expect(loadVariantBranchStock({ from: () => q } as never, 'org', 'branch', ['v'])).rejects.toThrow('verificar')
})

it('hydrates only variant stock for an opt-in branch read and name-only save has no delta', () => {
  const original = [{ id: 'v', stock_quantity: 8, sku: 'KEEP', purchase_price: null }]
  const rows = applyVariantBranchStock(original, new Map([['v', 3]]))
  expect(rows).toEqual([{ id: 'v', stock_quantity: 3, sku: 'KEEP', purchase_price: null }])
  expect(original[0].stock_quantity).toBe(8)
  expect(planVariantStockAdjustments(new Map([['v', 3]]), [{ id: 'v', stockQuantity: rows[0].stock_quantity }] as never)).toEqual([])
  expect(applyVariantBranchStock([{ id: 'missing', stock_quantity: 9 }], new Map())[0].stock_quantity).toBe(0)
})

it('edit form requests explicit branch stock and blocks saving before scoped hydration', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/dashboard/product-modal.tsx'), 'utf8')
  expect(source).toContain('variant_stock_scope=branch&branch_id=${encodeURIComponent(variantBranchId)}')
  expect(source).toContain('hydratedVariantProductId === variantHydrationKey')
  expect(source).toContain('if (!isExistingVariantDataReady) throw new Error(')
  expect(source).toContain("if (controller.signal.aborted) return")
  expect(source).toContain("form.getFieldState('variants').isDirty")
  expect(source).toContain('openedVariantBranch.current !== variantBranchId')
  expect(source).toContain('{ branch_id: variantBranchId }')
})
