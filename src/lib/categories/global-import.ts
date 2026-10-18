import { normalizeCategoryName, sortGlobalCategories, type GlobalCategory } from './global-catalog'

/**
 * Agregar categorías del catálogo global a una tienda.
 *
 * La tienda elige categorías globales y se crean en su catálogo con la misma
 * estructura, ya vinculadas: el marketplace las agrupa sin pasos extra. El plan
 * se arma acá, sin base de datos, para que la pantalla muestre lo mismo que
 * después hace el servidor.
 */

export type LocalCategory = {
  id: string
  name: string
  parent_id: string | null
  global_category_id?: string | null
}

export type ImportStep =
  /** Ya está en la tienda, vinculada a esta global. */
  | { kind: 'present'; globalId: string; localId: string; name: string }
  /** Hay una de la tienda con el mismo nombre y sin vincular: se vincula. */
  | { kind: 'link'; globalId: string; localId: string; name: string }
  /** No existe: se crea con este nombre, bajo el padre indicado. */
  | { kind: 'create'; globalId: string; name: string; parentGlobalId: string | null }

/** Las elegidas más sus padres: una subcategoría no puede quedar suelta. */
export function withAncestors(selectedIds: string[], catalog: GlobalCategory[]): GlobalCategory[] {
  const byId = new Map(catalog.map((category) => [category.id, category]))
  const wanted = new Set<string>()
  for (const id of selectedIds) {
    let current = byId.get(id)
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      wanted.add(current.id)
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }
  }
  // Padres primero: así cada una se crea cuando su padre ya existe.
  return sortGlobalCategories(catalog).filter((category) => wanted.has(category.id))
}

export function planGlobalImport(
  selectedIds: string[],
  catalog: GlobalCategory[],
  local: LocalCategory[],
): ImportStep[] {
  const byGlobal = new Map(
    local.filter((category) => category.global_category_id).map((category) => [category.global_category_id as string, category])
  )
  // Los nombres son únicos por tienda (sin distinguir mayúsculas).
  const byName = new Map(local.map((category) => [normalizeCategoryName(category.name), category]))
  const globalById = new Map(catalog.map((category) => [category.id, category]))
  const takenNames = new Set(local.map((category) => normalizeCategoryName(category.name)))
  const steps: ImportStep[] = []

  for (const global of withAncestors(selectedIds, catalog)) {
    const linked = byGlobal.get(global.id)
    if (linked) {
      steps.push({ kind: 'present', globalId: global.id, localId: linked.id, name: linked.name })
      continue
    }

    const sameName = byName.get(normalizeCategoryName(global.name))
    if (sameName && !sameName.global_category_id) {
      steps.push({ kind: 'link', globalId: global.id, localId: sameName.id, name: sameName.name })
      takenNames.add(normalizeCategoryName(sameName.name))
      continue
    }

    // El nombre está ocupado por otra categoría (vinculada a otra global): se
    // aclara con el padre, por ejemplo «Accesorios (Ropa)».
    let name = global.name
    if (takenNames.has(normalizeCategoryName(name))) {
      const parentName = global.parent_id ? globalById.get(global.parent_id)?.name : null
      name = parentName ? `${global.name} (${parentName})` : `${global.name} (catálogo)`
    }
    takenNames.add(normalizeCategoryName(name))
    steps.push({ kind: 'create', globalId: global.id, name, parentGlobalId: global.parent_id ?? null })
  }

  return steps
}
