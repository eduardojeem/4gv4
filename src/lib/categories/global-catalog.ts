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
  /**
   * Rubros en los que aplica. Vacía = todos. `undefined` = la base todavía no
   * tiene la columna (SQL sin correr): se trata como antes.
   */
  verticals?: string[] | null
}

/** ¿El catálogo ya sabe de rubros? (columna `verticals` creada). */
export function catalogHasVerticals(catalog: GlobalCategory[]): boolean {
  return catalog.some((category) => Array.isArray(category.verticals))
}

/**
 * Las categorías globales que le sirven a un rubro: las de ese rubro y las de
 * todos (sin rubro). Así «Accesorios» de una tienda de ropa no cae en
 * «Accesorios» de celulares.
 */
export function catalogForVertical(catalog: GlobalCategory[], vertical: string | null | undefined): GlobalCategory[] {
  if (!vertical || !catalogHasVerticals(catalog)) return catalog
  return catalog.filter((category) => !category.verticals?.length || category.verticals.includes(vertical))
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

/** Igual pero sin plurales: «Pendrive» y «Pendrives» son la misma categoría. */
function singular(value: string): string {
  const normalized = normalizeCategoryName(value)
  return normalized.endsWith('es') ? normalized.slice(0, -2) : normalized.endsWith('s') ? normalized.slice(0, -1) : normalized
}

/**
 * La categoría global parecida, cuando no hay una igual. Es una propuesta para
 * revisar, no una certeza: por eso vuelve marcada como aproximada.
 */
export function findSimilarGlobalCategory(
  name: string | null | undefined,
  catalog: GlobalCategory[],
): GlobalCategory | null {
  const needle = singular(name ?? '')
  if (needle.length < 4) return null

  for (const category of catalog) {
    if (category.is_active === false) continue
    if (singular(category.name) === needle) return category
    if ((category.aliases ?? []).some((alias) => singular(alias) === needle)) return category
  }

  return null
}

export type CategoryLinkSuggestion = {
  id: string
  global_category_id: string
  /** `false` cuando el nombre no es igual, solo parecido. */
  exact: boolean
}

/**
 * Lo que se propone vincular: primero los nombres iguales, después los
 * parecidos. Solo categorías sueltas: vincular no pisa lo ya decidido.
 */
export function suggestCategoryLinks(
  tenantCategories: Array<{ id: string; name: string; global_category_id?: string | null; vertical?: string | null }>,
  catalog: GlobalCategory[],
): CategoryLinkSuggestion[] {
  return tenantCategories.flatMap<CategoryLinkSuggestion>((category) => {
    if (category.global_category_id) return []
    // Solo entre las categorías del rubro de la empresa.
    const options = catalogForVertical(catalog, category.vertical)
    const exact = findGlobalCategoryByName(category.name, options)
    if (exact) return [{ id: category.id, global_category_id: exact.id, exact: true }]
    const similar = findSimilarGlobalCategory(category.name, options)
    return similar ? [{ id: category.id, global_category_id: similar.id, exact: false }] : []
  })
}

/**
 * Qué categorías de empresas se vincularían con el catálogo, por nombre.
 * Devuelve solo las que hoy están sueltas: vincular no pisa lo ya decidido.
 */
export function planCategoryLinks(
  tenantCategories: Array<{ id: string; name: string; global_category_id?: string | null; vertical?: string | null }>,
  catalog: GlobalCategory[],
): Array<{ id: string; global_category_id: string }> {
  return tenantCategories.flatMap((category) => {
    if (category.global_category_id) return []
    const match = findGlobalCategoryByName(category.name, catalogForVertical(catalog, category.vertical))
    return match ? [{ id: category.id, global_category_id: match.id }] : []
  })
}
