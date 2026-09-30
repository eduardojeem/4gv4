/**
 * Cómo se agrupan las fichas del catálogo global de productos en el
 * superadmin: por categoría global (con su madre), por marca o en una lista.
 * Lo que falta clasificar va primero: es el trabajo pendiente.
 */

export type GroupableProduct = {
  id: string
  name: string
  global_brand_id: string | null
  global_category_id: string | null
  brand_name: string | null
}

export type CategoryOption = { id: string; name: string; parent_id?: string | null; sort_order?: number | null }
export type BrandOption = { id: string; name: string }

export type ProductGroupView = 'category' | 'brand' | 'list'

export type ProductGroup<T> = {
  key: string
  label: string
  /** La categoría madre, para mostrar «Accesorios › Cargadores». */
  parentLabel: string | null
  /** Sin categoría o sin marca: lo que hay que clasificar. */
  pending: boolean
  items: T[]
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'es')

/** Orden de árbol: cada madre seguida de sus hijas. */
function categoryOrder(categories: CategoryOption[]): string[] {
  const children = new Map<string, CategoryOption[]>()
  for (const category of categories) {
    const key = category.parent_id ?? 'root'
    children.set(key, [...(children.get(key) ?? []), category])
  }
  const sorted = (rows: CategoryOption[]) => [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || byName(a, b))
  const order: string[] = []
  const walk = (parent: string) => {
    for (const category of sorted(children.get(parent) ?? [])) {
      order.push(category.id)
      walk(category.id)
    }
  }
  walk('root')
  return order
}

export function groupGlobalProducts<T extends GroupableProduct>(
  products: T[],
  view: ProductGroupView,
  categories: CategoryOption[],
  brands: BrandOption[],
): Array<ProductGroup<T>> {
  const items = [...products].sort(byName)
  if (view === 'list') return [{ key: 'all', label: 'Todos', parentLabel: null, pending: false, items }]

  const groups = new Map<string, ProductGroup<T>>()
  const add = (key: string, make: () => Omit<ProductGroup<T>, 'items'>, product: T) => {
    const group = groups.get(key) ?? { ...make(), items: [] }
    group.items.push(product)
    groups.set(key, group)
  }

  if (view === 'category') {
    const byId = new Map(categories.map((category) => [category.id, category]))
    for (const product of items) {
      const category = product.global_category_id ? byId.get(product.global_category_id) : undefined
      if (!category) {
        add('none', () => ({ key: 'none', label: 'Sin categoría', parentLabel: null, pending: true }), product)
        continue
      }
      const parent = category.parent_id ? byId.get(category.parent_id) : undefined
      add(category.id, () => ({ key: category.id, label: category.name, parentLabel: parent?.name ?? null, pending: false }), product)
    }
    const order = categoryOrder(categories)
    return [...groups.values()].sort((a, b) =>
      Number(b.pending) - Number(a.pending) || order.indexOf(a.key) - order.indexOf(b.key))
  }

  const brandName = new Map(brands.map((brand) => [brand.id, brand.name]))
  for (const product of items) {
    const catalogName = product.global_brand_id ? brandName.get(product.global_brand_id) : undefined
    if (catalogName) {
      add(product.global_brand_id!, () => ({ key: product.global_brand_id!, label: catalogName, parentLabel: null, pending: false }), product)
      continue
    }
    // Sin marca del catálogo: se agrupa por el texto, pero cuenta como pendiente.
    const text = product.brand_name?.trim()
    const key = text ? `text:${text.toLocaleLowerCase('es')}` : 'none'
    add(key, () => ({
      key,
      label: text ? `${text} (fuera del catálogo de marcas)` : 'Sin marca',
      parentLabel: null,
      pending: true,
    }), product)
  }
  return [...groups.values()].sort((a, b) =>
    Number(b.pending) - Number(a.pending) || (a.key === 'none' ? -1 : b.key === 'none' ? 1 : 0) || a.label.localeCompare(b.label, 'es'))
}
