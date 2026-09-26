/**
 * Ordena las categorías en jerarquía para mostrarlas en un desplegable.
 *
 * El selector del formulario de producto listaba todo plano: una subcategoría
 * se veía igual que una raíz, y dos hijas homónimas de padres distintos eran
 * indistinguibles. Acá se arma el orden padre → hijas y se expone la
 * profundidad y el nombre del padre para poder mostrarlo.
 */

export type CategoryTreeInput = {
  id: string
  name: string
  parent_id?: string | null
}

export type CategoryOption<T extends CategoryTreeInput = CategoryTreeInput> = {
  category: T
  /** 0 = raíz, 1 = hija, 2 = nieta… */
  depth: number
  /** Nombre del padre, para desambiguar hijas con el mismo nombre. */
  parentName: string | null
}

function byName(a: CategoryTreeInput, b: CategoryTreeInput) {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
}

/**
 * Devuelve las categorías ordenadas padre → hijas, con su profundidad.
 *
 * Tolera datos rotos a propósito: una categoría cuyo padre no existe se trata
 * como raíz en vez de desaparecer del selector, y un ciclo no cuelga la UI
 * aunque la API ya los impida al guardar.
 */
export function buildCategoryOptions<T extends CategoryTreeInput>(
  categories: T[] | null | undefined,
): CategoryOption<T>[] {
  const list = (categories ?? []).filter((category) => category && category.id)
  if (list.length === 0) return []

  const byId = new Map(list.map((category) => [category.id, category]))
  const childrenOf = new Map<string, T[]>()
  const roots: T[] = []

  for (const category of list) {
    const parentId = category.parent_id ?? null
    // Sin padre, con un padre que no existe, o apuntándose a sí misma: raíz.
    if (!parentId || parentId === category.id || !byId.has(parentId)) {
      roots.push(category)
      continue
    }
    const bucket = childrenOf.get(parentId) ?? []
    bucket.push(category)
    childrenOf.set(parentId, bucket)
  }

  const options: CategoryOption<T>[] = []
  const visited = new Set<string>()

  const walk = (category: T, depth: number, parentName: string | null) => {
    if (visited.has(category.id)) return
    visited.add(category.id)

    options.push({ category, depth, parentName })

    const children = [...(childrenOf.get(category.id) ?? [])].sort(byName)
    for (const child of children) {
      walk(child, depth + 1, category.name)
    }
  }

  for (const root of [...roots].sort(byName)) {
    walk(root, 0, null)
  }

  // Red de seguridad: si un ciclo dejó categorías fuera del recorrido, se
  // agregan al final en vez de que el usuario no las encuentre nunca.
  for (const category of list) {
    if (!visited.has(category.id)) {
      visited.add(category.id)
      options.push({ category, depth: 0, parentName: null })
    }
  }

  return options
}

/**
 * Prefijo visual para el desplegable: una rama por nivel de profundidad.
 *
 * Usa espacios duros (U+00A0) a proposito: el navegador colapsa los espacios
 * normales al principio del texto y la indentacion no se veria.
 */
export function getCategoryIndent(depth: number) {
  if (depth <= 0) return ''
  return `${'  '.repeat(depth - 1)}└─ `
}
