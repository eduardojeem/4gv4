/**
 * Buscar marcas en el servidor, para cuando ya no entran todas en memoria.
 *
 * El listado de productos carga las marcas de la organización de una sola vez
 * y sin tope (`select('*').eq('is_active', true)`). Con veinte o cien marcas
 * no molesta, pero una organización grande tiene otro problema: PostgREST
 * corta la respuesta en mil filas, y lo hace en silencio. Con la lista
 * recortada, el buscador no encontraría una marca que sí existe y ofrecería
 * crearla — y ahí la API responde 409 «ya existe» sin que se entienda por qué.
 *
 * Con este buscador, el nombre se consulta contra la base, no contra lo que
 * quedó cargado en la pantalla.
 */

export type MarcaEncontrada = { id: string; name: string }

/** Cuántas marcas trae cada búsqueda: lo que entra en la lista sin scrollear. */
export const MARCAS_POR_BUSQUEDA = 20

export async function searchBrandsOnServer(
  query: string,
  signal?: AbortSignal,
): Promise<MarcaEncontrada[]> {
  const params = new URLSearchParams({
    search: query.trim(),
    limit: String(MARCAS_POR_BUSQUEDA),
    is_active: 'true',
  })

  const response = await fetch(`/api/brands?${params.toString()}`, { signal })
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
    throw new Error(payload?.error || 'No se pudieron buscar las marcas')
  }

  return (payload.data as Array<{ id: string; name: string }>).map((marca) => ({
    id: marca.id,
    name: marca.name,
  }))
}
