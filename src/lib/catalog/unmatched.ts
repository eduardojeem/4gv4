/**
 * Lo que falta en el catálogo global.
 *
 * Vincular por nombre solo resuelve lo que ya existe en el catálogo, y hoy casi
 * nada existe: 99 de 105 marcas de empresas no tienen equivalente. Esas quedaban
 * invisibles —la pantalla decía «0 pendientes»— cuando son el trabajo real.
 *
 * Acá se agrupan por nombre, con cuántas empresas usan cada uno, para crearlas
 * en el catálogo de a una o de a varias.
 */

export type UnmatchedCatalogEntry = {
  /** El nombre tal como lo escribieron, el que más se repite. */
  name: string
  /** Cuántas filas de empresas usan ese nombre. */
  count: number
  organizations: string[]
  ids: string[]
}

/**
 * Entre «Xiaomi», «xiaomi» y «XIAOMI» conviene la primera: el nombre que se
 * elija acá queda como oficial en todo el marketplace.
 */
function readability(value: string): number {
  const shouting = value === value.toUpperCase() && value !== value.toLowerCase()
  if (shouting) return 0
  return value.slice(0, 1) === value.slice(0, 1).toUpperCase() ? 2 : 1
}

function betterSpelling(current: string, candidate: string): string {
  const difference = readability(candidate) - readability(current)
  if (difference !== 0) return difference > 0 ? candidate : current
  return current.localeCompare(candidate, 'es') <= 0 ? current : candidate
}

/**
 * Agrupa por nombre normalizado las marcas o categorías de empresas que no
 * tienen a dónde vincularse. Primero las más usadas: crear esas en el catálogo
 * es lo que más ordena el marketplace.
 */
export function groupUnmatched(
  rows: Array<{ id: string; name: string; organizationName?: string | null }>,
  normalize: (value: string | null | undefined) => string,
  limit = 120,
): UnmatchedCatalogEntry[] {
  const groups = new Map<string, UnmatchedCatalogEntry & { spellings: Map<string, number> }>()

  for (const row of rows) {
    const key = normalize(row.name)
    if (!key) continue

    const name = String(row.name ?? '').trim()
    const group = groups.get(key) ?? { name, count: 0, organizations: [], ids: [], spellings: new Map() }
    group.count += 1
    group.ids.push(row.id)
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1)
    const organization = row.organizationName?.trim()
    if (organization && !group.organizations.includes(organization)) group.organizations.push(organization)
    groups.set(key, group)
  }

  return [...groups.values()]
    .map(({ spellings, ...group }) => ({
      ...group,
      name: [...spellings.entries()].reduce(
        (best, [name, times]) =>
          times > best[1] ? [name, times] as const : times === best[1] ? [betterSpelling(best[0], name), times] as const : best,
        ['', 0] as readonly [string, number],
      )[0] || group.name,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}
