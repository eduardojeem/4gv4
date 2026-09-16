/**
 * Catálogo global de categorías.
 *
 * Cada empresa tiene sus propias categorías; el marketplace las agrupa por la
 * categoría global para que «Celulares» de una tienda y «Telefonía» de otra
 * caigan en el mismo lugar. La taxonomía la administra la plataforma.
 *
 * Las reglas de nombre y búsqueda viven acá para que el panel del superadmin y
 * el vínculo automático usen exactamente el mismo criterio.
 */

export type GlobalCategory = {
  id: string
  name: string
  slug: string
  parent_id?: string | null
  level?: number | null
  aliases?: string[] | null
  icon?: string | null
  sort_order?: number | null
  is_active?: boolean | null
}

export function normalizeCategoryName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function categorySlug(value: string | null | undefined): string {
  return normalizeCategoryName(value).replace(/\s+/g, '-')
}

/** La categoría global que corresponde a una de empresa, si la hay. */
export function findGlobalCategoryByName(
  name: string | null | undefined,
  catalog: GlobalCategory[],
): GlobalCategory | null {
  const needle = normalizeCategoryName(name)
  if (!needle) return null

  for (const category of catalog) {
    if (category.is_active === false) continue
    if (normalizeCategoryName(category.name) === needle) return category
    if (categorySlug(category.slug) === needle.replace(/\s+/g, '-')) return category
    if ((category.aliases ?? []).some((alias) => normalizeCategoryName(alias) === needle)) return category
  }

  return null
}

/** Padres primero y, dentro de cada nivel, por orden y nombre: como se lee un árbol. */
export function sortGlobalCategories(catalog: GlobalCategory[]): GlobalCategory[] {
  const byParent = new Map<string, GlobalCategory[]>()
  for (const category of catalog) {
    const key = category.parent_id ?? 'root'
    byParent.set(key, [...(byParent.get(key) ?? []), category])
  }

  const order = (rows: GlobalCategory[]) =>
    [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'es'))

  const result: GlobalCategory[] = []
  const walk = (parent: string) => {
    for (const category of order(byParent.get(parent) ?? [])) {
      result.push(category)
      walk(category.id)
    }
  }
  walk('root')

  // Una categoría cuyo padre ya no está no puede desaparecer de la lista.
  const seen = new Set(result.map((category) => category.id))
  return [...result, ...order(catalog.filter((category) => !seen.has(category.id)))]
}

/**
 * Qué categorías de empresas se vincularían con el catálogo, por nombre.
 * Devuelve solo las que hoy están sueltas: vincular no pisa lo ya decidido.
 */
export function planCategoryLinks(
  tenantCategories: Array<{ id: string; name: string; global_category_id?: string | null }>,
  catalog: GlobalCategory[],
): Array<{ id: string; global_category_id: string }> {
  return tenantCategories.flatMap((category) => {
    if (category.global_category_id) return []
    const match = findGlobalCategoryByName(category.name, catalog)
    return match ? [{ id: category.id, global_category_id: match.id }] : []
  })
}
