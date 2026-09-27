export type PublicCatalogCategory = {
  id: string
  name: string
  parent_id: string | null
}

export type PublicCatalogCategoryNode = PublicCatalogCategory & {
  subcategories: PublicCatalogCategoryNode[]
}

export function resolveEffectiveProductStock(
  globalStock: number | null | undefined,
  branchInventory: Array<{ stock_quantity: number | null }> | { stock_quantity: number | null } | null | undefined,
  branchScoped: boolean,
) {
  if (!branchScoped) return Math.max(0, Number(globalStock ?? 0))

  const rows = Array.isArray(branchInventory)
    ? branchInventory
    : branchInventory
      ? [branchInventory]
      : []

  return rows.reduce((total, row) => total + Math.max(0, Number(row.stock_quantity ?? 0)), 0)
}

export function buildVisibleCategoryTree(
  categories: PublicCatalogCategory[],
  productCategoryIds: Array<string | null | undefined>,
): PublicCatalogCategoryNode[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const visibleIds = new Set(productCategoryIds.filter((id): id is string => Boolean(id)))

  for (const categoryId of [...visibleIds]) {
    let parentId = categoryById.get(categoryId)?.parent_id
    while (parentId && !visibleIds.has(parentId)) {
      visibleIds.add(parentId)
      parentId = categoryById.get(parentId)?.parent_id
    }
  }

  const nodes = new Map<string, PublicCatalogCategoryNode>()
  for (const category of categories) {
    if (!visibleIds.has(category.id)) continue
    nodes.set(category.id, { ...category, subcategories: [] })
  }

  const roots: PublicCatalogCategoryNode[] = []
  for (const category of categories) {
    const node = nodes.get(category.id)
    if (!node) continue
    const parent = category.parent_id ? nodes.get(category.parent_id) : undefined
    if (parent) parent.subcategories.push(node)
    else roots.push(node)
  }

  return roots
}
