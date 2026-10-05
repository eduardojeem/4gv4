import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mergeAttributeSuggestions,
  summarizeVariantProducts,
  variantIssues,
  type VariantSyncProduct,
  type VariantSyncRow,
} from '@/lib/inventory/variant-sync'
import { buildCategoryTree } from '@/components/admin/inventory/InventoryCategoriesPanel'
import type { Category } from '@/hooks/useCategories'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const product: VariantSyncProduct = { id: 'p1', name: 'Remera básica', sku: 'REM', image_url: null, sale_price: 80000, wholesale_price: 70000 }
const variant = (overrides: Partial<VariantSyncRow> = {}): VariantSyncRow => ({
  id: 'v1', product_id: 'p1', variant_name: 'S / Negro', sku: 'REM-S-N', is_active: true,
  sale_price: 80000, wholesale_price: 70000, branch_stock: 5, ...overrides,
})

describe('cuándo se puede cobrar una variante, como en el POS', () => {
  it('activa, con stock en la sucursal y al precio del producto', () => {
    expect(variantIssues(variant(), product)).toEqual([])
  })

  it('sin fila en la sucursal el POS responde VARIANT_NOT_IN_POS_SCOPE', () => {
    expect(variantIssues(variant({ branch_stock: null }), product)).toEqual(['not_in_branch'])
  })

  it('con otro precio el POS responde VARIANT_PRICE_REQUIRES_SYNC', () => {
    expect(variantIssues(variant({ sale_price: 90000 }), product)).toContain('price_mismatch')
    expect(variantIssues(variant({ wholesale_price: 60000 }), product)).toContain('price_mismatch')
  })

  it('el mayorista solo cuenta si el producto tiene uno propio', () => {
    expect(variantIssues(variant({ wholesale_price: 60000 }), { ...product, wholesale_price: 0 })).toEqual([])
  })

  it('una inactiva no se evalúa más: no se vende', () => {
    expect(variantIssues(variant({ is_active: false, branch_stock: null }), product)).toEqual(['inactive'])
  })
})

describe('resumen por producto', () => {
  it('cuenta lo vendible y pone primero lo que bloquea ventas', () => {
    const other: VariantSyncProduct = { ...product, id: 'p2', name: 'Abrigo' }
    const summary = summarizeVariantProducts([other, product], [
      variant(),
      variant({ id: 'v2', branch_stock: 0 }),
      variant({ id: 'v3', product_id: 'p2', branch_stock: null }),
    ])
    expect(summary.map((item) => item.product.id)).toEqual(['p2', 'p1'])
    expect(summary[1]).toMatchObject({ sellable: 1, branchStock: 5, issues: { out_of_stock: 1, not_in_branch: 0, price_mismatch: 0 } })
    expect(summary[0].issues.not_in_branch).toBe(1)
  })

  it('los productos sin variantes no aparecen', () => {
    expect(summarizeVariantProducts([product], [])).toEqual([])
  })
})

describe('los atributos guardados alimentan el editor de variantes', () => {
  it('van primero, con sus opciones en orden, y no se repiten con los del rubro', () => {
    const merged = mergeAttributeSuggestions(
      [{ id: 'a1', name: 'Talle', type: 'size', options: [{ value: 'L', sort_order: 3 }, { value: 'S', sort_order: 1 }, { value: 'X', active: false }] }],
      [
        { key: 'talle', label: 'Talle', control: 'select', examples: ['M'], customizable: true },
        { key: 'color', label: 'Color', control: 'color', examples: ['Negro'], customizable: true },
      ],
    )
    expect(merged.map((item) => [item.label, item.source])).toEqual([['Talle', 'saved'], ['Color', 'vertical']])
    expect(merged[0]).toMatchObject({ control: 'select', examples: ['S', 'L'] })
  })
})

describe('categorías en árbol', () => {
  const category = (id: string, name: string, parent_id: string | null = null) => ({ id, name, parent_id }) as unknown as Category
  it('agrupa subcategorías bajo su padre y ordena por nombre', () => {
    const tree = buildCategoryTree([category('b', 'Ropa'), category('a', 'Accesorios'), category('c', 'Fundas', 'a'), category('d', 'Cables', 'a')])
    expect(tree.map((node) => [node.category.name, node.children.map((child) => child.name)])).toEqual([
      ['Accesorios', ['Cables', 'Fundas']],
      ['Ropa', []],
    ])
  })
  it('una subcategoría sin su padre queda como raíz', () => {
    expect(buildCategoryTree([category('x', 'Huérfana', 'no-existe')]).map((node) => node.category.name)).toEqual(['Huérfana'])
  })
})

describe('la pantalla usa las piezas del resto del sistema', () => {
  const PANTALLA = read('src/components/admin/inventory/inventory-management.tsx')
  const PROMOS = read('src/components/admin/inventory/PromotionManager.tsx')

  it('las variantes se editan en la ficha del producto', () => {
    expect(PANTALLA).toContain("openEditDialog(product, 'variants')")
    expect(PANTALLA).toContain('initialTab={modalTab}')
    expect(PANTALLA).not.toContain('<VariantManager productId=')
  })

  it('promociones usa el mismo modal y la misma lista que la sección de Promociones', () => {
    expect(PROMOS).toContain("import('@/components/dashboard/promotions/PromotionDialog')")
    expect(PROMOS).toContain('<PromotionList')
    expect(PROMOS).not.toContain('interface PromotionFormData')
  })

  it('categorías usa el mismo formulario que el panel', () => {
    expect(read('src/components/admin/inventory/InventoryCategoriesPanel.tsx')).toContain('<CategoryModal')
    expect(PANTALLA).toContain('<InventoryCategoriesPanel')
  })
})
