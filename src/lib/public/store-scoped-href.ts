/**
 * Enlaces del cliente hacia el detalle de una reparación o de un pedido.
 *
 * Las dos pantallas de destino resuelven a que cliente pertenece el registro
 * solo cuando conocen la tienda: `if (user && organization)` en
 * `api/public/repairs/[ticketId]` y `resolvePublicOrganization` en
 * `api/public/orders/track`. Sin tienda en la ruta no hay autorizacion —el
 * detalle queda vacio— o se resuelve la organizacion por defecto, que no es la
 * duena del pedido.
 *
 * En el marketplace el perfil junta datos de varias tiendas, asi que el prefijo
 * de la ruta actual (vacio) no sirve: cada enlace tiene que llevar el slug de
 * SU tienda, que ya viene en los datos. Dentro de una tienda el resultado es el
 * mismo prefijo de siempre, porque ahi todo esta filtrado a esa organizacion.
 */

export function storeScopedPrefix(
  storeSlug: string | null | undefined,
  fallbackPrefix = ''
): string {
  const slug = storeSlug?.trim()
  if (slug) return `/${slug}`
  return fallbackPrefix
}

export function customerRepairsListHref(
  storeSlug: string | null | undefined,
  fallbackPrefix = ''
): string {
  return `${storeScopedPrefix(storeSlug, fallbackPrefix)}/mis-reparaciones`
}

export function customerRepairHref(
  storeSlug: string | null | undefined,
  fallbackPrefix: string,
  repairRef: string
): string {
  return `${customerRepairsListHref(storeSlug, fallbackPrefix)}/${encodeURIComponent(repairRef)}`
}

export function customerOrderTrackHref(
  storeSlug: string | null | undefined,
  fallbackPrefix: string,
  orderNumber?: string | null
): string {
  const base = `${storeScopedPrefix(storeSlug, fallbackPrefix)}/track`
  if (!orderNumber) return base
  return `${base}?orderNumber=${encodeURIComponent(orderNumber)}`
}
