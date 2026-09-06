/** Cuantos resultados de busqueda se muestran de una, sin paginar. */
export const SEARCH_RESULTS_LIMIT = 100

export interface CustomerPageOptions {
  /** Hay una busqueda activa. Recorrer el padron y buscar no son lo mismo. */
  isSearching: boolean
  currentPage: number
  itemsPerPage: number
  /** Tope de resultados visibles al buscar. */
  limit?: number
}

export interface CustomerPage<T> {
  visible: T[]
  currentPage: number
  itemsPerPage: number
  totalItems: number
  totalPages: number
  /** Quedaron coincidencias afuera por el tope: hay que decirlo. */
  truncated: boolean
}

/**
 * Que clientes se ven.
 *
 * Al recorrer el padron, de a 10 esta bien. Pero al BUSCAR, la lista ya viene
 * recortada y ordenada por relevancia: partirla en paginas obligaba a navegar
 * para llegar a alguien que el buscador ya habia encontrado. Peor todavia,
 * `currentPage` venia de antes de escribir, asi que se caia en el medio de los
 * resultados en vez de arriba.
 *
 * Mientras hay busqueda se muestran todos los resultados de una, hasta un tope
 * para no pintar miles de filas si la consulta es muy general.
 */
export function paginateCustomers<T>(rows: T[], options: CustomerPageOptions): CustomerPage<T> {
  const { isSearching, itemsPerPage } = options
  const limit = options.limit ?? SEARCH_RESULTS_LIMIT
  const totalItems = rows.length
  const safeItemsPerPage = Math.max(1, itemsPerPage)

  if (isSearching) {
    const visible = rows.slice(0, limit)
    return {
      visible,
      currentPage: 1,
      itemsPerPage: visible.length,
      totalItems,
      totalPages: 1,
      truncated: totalItems > visible.length,
    }
  }

  const totalPages = Math.ceil(totalItems / safeItemsPerPage)
  // Una pagina que ya no existe —porque cambio un filtro— vuelve a la primera,
  // no a la ultima: lo que se busca esta arriba, no al final.
  const currentPage =
    options.currentPage > totalPages && totalPages > 0 ? 1 : Math.max(1, options.currentPage)
  const startIndex = (currentPage - 1) * safeItemsPerPage

  return {
    visible: rows.slice(startIndex, startIndex + safeItemsPerPage),
    currentPage,
    itemsPerPage: safeItemsPerPage,
    totalItems,
    totalPages,
    truncated: false,
  }
}
