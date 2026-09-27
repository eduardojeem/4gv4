import { describe, expect, it } from 'vitest'
import { buildVisibleCategoryTree, resolveEffectiveProductStock } from '@/lib/public/catalog'

describe('public catalog helpers', () => {
  it('uses branch inventory when the catalog is scoped to a branch', () => {
    expect(resolveEffectiveProductStock(12, [{ stock_quantity: 2 }], true)).toBe(2)
    expect(resolveEffectiveProductStock(12, [], true)).toBe(0)
    expect(resolveEffectiveProductStock(12, null, false)).toBe(12)
  })

  it('keeps categories with public products and their parent categories', () => {
    const categories = [
      { id: 'parent', name: 'Accesorios', parent_id: null },
      { id: 'used-child', name: 'Cargadores', parent_id: 'parent' },
      { id: 'empty-child', name: 'Audio', parent_id: 'parent' },
      { id: 'empty-root', name: 'Servicios', parent_id: null },
    ]

    expect(buildVisibleCategoryTree(categories, ['used-child'])).toEqual([
      {
        id: 'parent',
        name: 'Accesorios',
        parent_id: null,
        subcategories: [
          { id: 'used-child', name: 'Cargadores', parent_id: 'parent', subcategories: [] },
        ],
      },
    ])
  })
})
