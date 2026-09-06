/**
 * Qué decir del catálogo de una tienda.
 *
 * «0 productos» o «Catálogo en preparación» tapaban tres situaciones distintas:
 *
 *   1. La tienda que todavía no cargó nada.
 *   2. La que carga pero no publica al marketplace: usa el sistema puertas
 *      adentro para su propia gestión. Es un caso normal, no un catálogo a
 *      medio hacer, y decirle «en preparación» a un negocio con mil productos
 *      cargados es sencillamente falso.
 *   3. La que publica pero se quedó sin stock: `products_count` solo cuenta lo
 *      que tiene existencia, porque es lo que un comprador puede comprar.
 *
 * La diferencia entre `products_count` —publicados y con stock— y
 * `products_total` —todo lo activo— es lo que permite separarlas.
 */

export type CatalogCounts = {
  products_count?: number | null
  products_total?: number | null
}

export type CatalogState = {
  label: string
  /** Aclaración corta, o null cuando el label se explica solo. */
  hint: string | null
  /** Para decidir estilo: un catálogo interno no es un catálogo vacío. */
  kind: 'published' | 'internal' | 'empty'
}

export function describeCatalogState(store: CatalogCounts): CatalogState {
  const publicados = store.products_count ?? 0
  const total = store.products_total ?? 0

  if (publicados > 0) {
    return {
      label: `${publicados.toLocaleString('es-PY')} producto${publicados === 1 ? '' : 's'}`,
      hint: null,
      kind: 'published',
    }
  }

  // Sin `products_total` no se puede distinguir: quien no lo pasa se queda con
  // el mensaje neutro de siempre en vez de una afirmación que no puede sostener.
  if (total > 0) {
    return {
      label: 'Catálogo interno',
      hint: 'No publica al marketplace',
      kind: 'internal',
    }
  }

  return { label: 'Catálogo en preparación', hint: null, kind: 'empty' }
}
