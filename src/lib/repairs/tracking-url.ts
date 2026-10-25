import { getSiteUrl } from '@/lib/site-url'

/**
 * URL del QR de seguimiento que va en el comprobante de reparación.
 *
 * Antes el QR apuntaba a `{origen}/mis-reparaciones/{ticket}?verify=…`. Esa
 * ruta sin tienda es «legacy»: el proxy la redirige a `/marketplace` (o a la
 * tienda por defecto) y pierde el ticket, así que escanearlo no llevaba a la
 * reparación. Además el origen era el del navegador que imprimía.
 *
 * Ahora va a la página de la tienda, `/{slug}/mis-reparaciones/{ticket}`, con
 * el dominio canónico. La página filtra por esa tienda y solo muestra la
 * reparación si `verify` es la firma del servidor para ese ticket y cliente:
 * sin firma válida no se ve nada, y no sirve para mirar las de otro cliente.
 */

/** Lo que devuelve POST /api/repairs/sign y viaja hasta el comprobante. */
export interface RepairQrSignature {
  hash: string
  trackingUrl: string
  /** La tienda online, para imprimirla al pie si la configuración lo pide. */
  storeUrl?: string
}

/**
 * Inicio de la tienda online: `{sitio}/{slug}/inicio`. Con el dominio canónico
 * (getSiteUrl), así el papel nunca lleva localhost aunque se imprima en local.
 */
export function buildStoreHomeUrl({
  organizationSlug,
  siteUrl = getSiteUrl(),
}: {
  organizationSlug: string | null | undefined
  siteUrl?: string
}): string | null {
  const slug = organizationSlug?.trim()
  if (!slug) return null
  return `${siteUrl.replace(/\/+$/, '')}/${encodeURIComponent(slug)}/inicio`
}

export function buildRepairTrackingUrl({
  organizationSlug,
  ticketNumber,
  hash,
  siteUrl = getSiteUrl(),
}: {
  organizationSlug: string | null | undefined
  ticketNumber: string | null | undefined
  hash: string | null | undefined
  siteUrl?: string
}): string | null {
  const slug = organizationSlug?.trim()
  const ticket = ticketNumber?.trim()
  const verify = hash?.trim()
  // Sin tienda la ruta cae en la redirección legacy; mejor sin QR que un QR roto.
  if (!slug || !ticket || !verify) return null

  const base = siteUrl.replace(/\/+$/, '')
  return `${base}/${encodeURIComponent(slug)}/mis-reparaciones/${encodeURIComponent(ticket)}?verify=${encodeURIComponent(verify)}`
}
