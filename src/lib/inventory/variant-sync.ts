import type { VariantAttributeControl, VariantAttributeSuggestion } from '@/lib/products/vertical-attributes'

/**
 * Qué impide vender una variante en el punto de venta. Replica las reglas de
 * `process_pos_sale_atomic_v5`: la variante tiene que estar activa y tener su
 * fila de stock en la sucursal. Desde 20261118120000 cada variante se cobra con
 * su propio precio, así que un precio distinto al del producto ya no bloquea.
 */

export interface VariantSyncRow {
  id: string
  product_id: string
  variant_name: string | null
  sku: string | null
  is_active: boolean | null
  sale_price: number | null
  wholesale_price: number | null
  /** Stock de la sucursal; null si la variante no tiene fila en esa sucursal. */
  branch_stock: number | null
}

export interface VariantSyncProduct {
  id: string
  name: string
  sku: string | null
  image_url: string | null
  sale_price: number | null
  wholesale_price: number | null
}

export type VariantIssue = 'inactive' | 'not_in_branch' | 'out_of_stock'

export interface VariantStatus {
  id: string
  name: string
  sku: string | null
  stock: number | null
  sellable: boolean
  issues: VariantIssue[]
}

export interface VariantProductSummary {
  product: VariantSyncProduct
  variants: VariantStatus[]
  /** Variantes que se pueden cobrar ahora en la sucursal. */
  sellable: number
  /** Stock de todas las variantes en la sucursal. */
  branchStock: number
  issues: Record<Exclude<VariantIssue, 'inactive'>, number>
}

export function variantIssues(variant: VariantSyncRow, _product?: VariantSyncProduct): VariantIssue[] {
  if (variant.is_active === false) return ['inactive']
  const issues: VariantIssue[] = []
  if (variant.branch_stock === null) issues.push('not_in_branch')
  else if (variant.branch_stock <= 0) issues.push('out_of_stock')
  return issues
}

export function summarizeVariantProducts(products: VariantSyncProduct[], variants: VariantSyncRow[]): VariantProductSummary[] {
  const byProduct = new Map<string, VariantSyncRow[]>()
  for (const variant of variants) {
    const list = byProduct.get(variant.product_id) ?? []
    list.push(variant)
    byProduct.set(variant.product_id, list)
  }

  return products
    .filter((product) => byProduct.has(product.id))
    .map((product) => {
      const statuses = (byProduct.get(product.id) ?? []).map((variant): VariantStatus => {
        const issues = variantIssues(variant, product)
        return {
          id: variant.id,
          name: variant.variant_name?.trim() || variant.sku || 'Variante',
          sku: variant.sku,
          stock: variant.branch_stock,
          // Agotada se puede elegir igual: no es un problema de configuración.
          sellable: issues.every((issue) => issue === 'out_of_stock'),
          issues,
        }
      })
      const count = (issue: VariantIssue) => statuses.filter((status) => status.issues.includes(issue)).length
      return {
        product,
        variants: statuses,
        sellable: statuses.filter((status) => status.sellable && !status.issues.includes('out_of_stock')).length,
        branchStock: statuses.reduce((sum, status) => sum + Math.max(0, status.stock ?? 0), 0),
        issues: {
          not_in_branch: count('not_in_branch'),
          out_of_stock: count('out_of_stock'),
        },
      }
    })
    // Primero lo que impide vender.
    .sort((a, b) => b.issues.not_in_branch - a.issues.not_in_branch
      || a.product.name.localeCompare(b.product.name, 'es'))
}

// ---------------------------------------------------------------------------
// Atributos guardados como sugerencias del editor de variantes
// ---------------------------------------------------------------------------

export interface SavedAttribute {
  id: string
  name: string
  type: 'color' | 'size' | 'text' | 'number'
  options: Array<{ value: string; active?: boolean; sort_order?: number }>
}

export type AttributeSuggestion = VariantAttributeSuggestion & { source: 'saved' | 'vertical' }

const slug = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

const CONTROL_BY_TYPE: Record<SavedAttribute['type'], VariantAttributeControl> = {
  color: 'color',
  size: 'select',
  number: 'number',
  text: 'select',
}

/**
 * Los atributos que la empresa guardó («Talle» con S, M, L) aparecen primero
 * al crear variantes; después, los sugeridos del rubro que no repiten nombre.
 */
export function mergeAttributeSuggestions(saved: SavedAttribute[], vertical: VariantAttributeSuggestion[]): AttributeSuggestion[] {
  const fromSaved: AttributeSuggestion[] = saved
    .filter((attribute) => attribute.name.trim())
    .map((attribute) => ({
      key: slug(attribute.name) || attribute.id,
      label: attribute.name.trim(),
      control: CONTROL_BY_TYPE[attribute.type] ?? 'select',
      examples: attribute.options
        .filter((option) => option.active !== false && option.value.trim())
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((option) => option.value.trim()),
      customizable: true as const,
      source: 'saved' as const,
    }))
  const taken = new Set(fromSaved.flatMap((item) => [item.key, slug(item.label)]))
  const fromVertical = vertical
    .filter((item) => !taken.has(item.key) && !taken.has(slug(item.label)))
    .map((item) => ({ ...item, source: 'vertical' as const }))
  return [...fromSaved, ...fromVertical]
}
