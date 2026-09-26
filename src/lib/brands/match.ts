/**
 * Buscar una marca entre las que ya tiene la tienda.
 *
 * El formulario de producto ofrecía la marca en una lista desplegable sin
 * búsqueda: con veinticinco o treinta marcas cargadas, encontrar «Western
 * Digital» era bajar a mano hasta el final, y crear una nueva estaba detrás de
 * un botón de «+» sin texto. Así es como termina un catálogo con «Samsung» y
 * «SAMSUNG» como dos marcas distintas.
 *
 * Comparar ignora mayúsculas y acentos porque nadie escribe dos veces igual el
 * mismo nombre.
 */

export type MarcaComparable = { id: string; name: string }

/** Minúsculas, sin acentos y sin espacios de más. */
export function normalizeBrandName(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Las marcas que coinciden con lo escrito, con las que empiezan igual primero:
 * quien escribe «sam» busca «Samsung», no «Samsung Test 123».
 */
export function filterBrands<T extends MarcaComparable>(brands: T[], query: string): T[] {
  const buscado = normalizeBrandName(query)
  const ordenadas = [...brands].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  if (!buscado) return ordenadas

  const empiezan: T[] = []
  const contienen: T[] = []
  for (const marca of ordenadas) {
    const nombre = normalizeBrandName(marca.name)
    if (nombre.startsWith(buscado)) empiezan.push(marca)
    else if (nombre.includes(buscado)) contienen.push(marca)
  }
  return [...empiezan, ...contienen]
}

/**
 * La marca que ya se llama así. Si existe, no hay nada que crear: crearla
 * devuelve 409 desde la API, y el usuario se queda sin saber por qué.
 */
export function findExistingBrand<T extends MarcaComparable>(brands: T[], name: string): T | null {
  const buscado = normalizeBrandName(name)
  if (!buscado) return null
  return brands.find((marca) => normalizeBrandName(marca.name) === buscado) ?? null
}
