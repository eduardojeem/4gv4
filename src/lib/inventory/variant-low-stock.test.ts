import { describe, expect, it } from 'vitest'
import { classifyStock, matchesProductStockFilter, summarizeVariantStock } from './variant-low-stock'

const variants = [
  { id: 'v1', stock_quantity: 20, min_stock: 3, is_active: true },
  { id: 'v2', stock_quantity: 2, min_stock: 3, is_active: true },
  { id: 'v3', stock_quantity: 10, min_stock: 3, is_active: true },
  { id: 'v4', stock_quantity: 8, min_stock: 3, is_active: true },
]
const inventory = [
  { organization_id: 'org-a', branch_id: 'branch-a', variant_id: 'v1', stock_quantity: 0, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-a', variant_id: 'v2', stock_quantity: 2, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-a', variant_id: 'v3', stock_quantity: 10, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-a', variant_id: 'v4', stock_quantity: 8, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-b', variant_id: 'v1', stock_quantity: 12, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-b', variant_id: 'v2', stock_quantity: 8, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-b', variant_id: 'v3', stock_quantity: 4, min_stock: 3 },
  { organization_id: 'org-a', branch_id: 'branch-b', variant_id: 'v4', stock_quantity: 8, min_stock: 3 },
  { organization_id: 'org-b', branch_id: 'branch-a', variant_id: 'v1', stock_quantity: 0, min_stock: 3 },
]

describe('variant low-stock classification', () => {
  it('classifies zero, below-minimum, equal-minimum, and above-minimum stock', () => {
    expect(classifyStock(0, 3)).toBe('out_of_stock')
    expect(classifyStock(2, 3)).toBe('low_stock')
    expect(classifyStock(3, 3)).toBe('low_stock')
    expect(classifyStock(4, 3)).toBe('in_stock')
  })

  it('counts affected active variants even when product total is healthy', () => {
    const result = summarizeVariantStock({ organizationId: 'org-a', variants, inventory, branchId: 'branch-a' })
    expect(result.summary).toEqual({ variantCount: 4, outOfStockVariantCount: 1, lowStockVariantCount: 1, affectedVariantCount: 2, totalStock: 20 })
  })

  it('isolates branch status before aggregation', () => {
    const branchA = summarizeVariantStock({ organizationId: 'org-a', variants, inventory, branchId: 'branch-a' })
    const branchB = summarizeVariantStock({ organizationId: 'org-a', variants, inventory, branchId: 'branch-b' })
    expect(branchA.details.get('v1')?.status).toBe('out_of_stock')
    expect(branchB.details.get('v1')?.status).toBe('in_stock')
    expect(branchA.summary.affectedVariantCount).toBe(2)
    expect(branchB.summary.affectedVariantCount).toBe(0)
  })

  it('does not count inventory rows from another organization', () => {
    const result = summarizeVariantStock({ organizationId: 'org-a', variants: [variants[0]], inventory, branchId: 'branch-a' })
    expect(result.details.get('v1')?.currentStock).toBe(0)
    expect(result.summary.outOfStockVariantCount).toBe(1)
  })

  it('ignores variant records that belong to another organization', () => {
    const result = summarizeVariantStock({
      organizationId: 'org-a',
      variants: [{ id: 'foreign', organization_id: 'org-b', stock_quantity: 0, min_stock: 8 }],
      inventory,
    })
    expect(result.summary).toEqual({ variantCount: 0, outOfStockVariantCount: 0, lowStockVariantCount: 0, affectedVariantCount: 0, totalStock: 0 })
  })

  it('uses only configured active branches in the all-branches view', () => {
    const result = summarizeVariantStock({ organizationId: 'org-a', variants, inventory, accessibleBranchIds: ['branch-b'] })
    expect(result.summary.affectedVariantCount).toBe(0)
    expect(result.details.get('v1')?.branchStatuses.map((row) => row.branchId)).toEqual(['branch-b'])
  })

  it('excludes inactive variants and retains zero-minimum as the existing threshold', () => {
    const result = summarizeVariantStock({
      organizationId: 'org-a',
      variants: [{ id: 'inactive', stock_quantity: 99, min_stock: 0, is_active: false }, { id: 'zero-min', stock_quantity: 1, min_stock: 0 }],
      inventory: [],
    })
    expect(result.summary).toEqual({ variantCount: 1, outOfStockVariantCount: 0, lowStockVariantCount: 0, affectedVariantCount: 0, totalStock: 1 })
  })

  it('treats a missing row in a selected branch as zero using the variant minimum', () => {
    const result = summarizeVariantStock({ organizationId: 'org-a', variants: [{ id: 'missing', stock_quantity: 12, min_stock: 2 }], inventory: [], branchId: 'branch-a' })
    expect(result.details.get('missing')).toMatchObject({ status: 'out_of_stock', currentStock: 0, minimumStock: 2 })
  })

  it('falls back to the existing aggregate variant stock when no accessible branch row exists', () => {
    const result = summarizeVariantStock({ organizationId: 'org-a', variants: [{ id: 'fallback', stock_quantity: 2, min_stock: 2 }], inventory: [], accessibleBranchIds: ['branch-a'] })
    expect(result.summary.lowStockVariantCount).toBe(1)
    expect(result.summary.totalStock).toBe(2)
  })

  it('includes a variant product in low-stock filtering when any active variant is empty or low', () => {
    const summary = summarizeVariantStock({ organizationId: 'org-a', variants, inventory, branchId: 'branch-a' }).summary
    expect(matchesProductStockFilter({ filter: 'low_stock', stock: 20, minimumStock: 1, variantSummary: summary })).toBe(true)
    expect(matchesProductStockFilter({ filter: 'out_of_stock', stock: 20, minimumStock: 1, variantSummary: summary })).toBe(false)
  })

  it('preserves simple-product low-stock filtering and excludes zero from low but includes it as out', () => {
    expect(matchesProductStockFilter({ filter: 'low_stock', stock: 2, minimumStock: 3 })).toBe(true)
    expect(matchesProductStockFilter({ filter: 'low_stock', stock: 0, minimumStock: 3 })).toBe(false)
    expect(matchesProductStockFilter({ filter: 'out_of_stock', stock: 0, minimumStock: 3 })).toBe(true)
  })

  it('does not create stock alerts when all variants are inactive', () => {
    const summary = summarizeVariantStock({ organizationId: 'org-a', variants: [{ id: 'inactive', stock_quantity: 0, min_stock: 5, is_active: false }], inventory: [] }).summary
    expect(matchesProductStockFilter({ filter: 'out_of_stock', stock: 0, minimumStock: 5, variantSummary: summary })).toBe(false)
    expect(matchesProductStockFilter({ filter: 'low_stock', stock: 0, minimumStock: 5, variantSummary: summary })).toBe(false)
  })
})
