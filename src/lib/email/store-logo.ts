import { siteUrl } from '@/lib/site-url'

/**
 * Logo de una tienda para sus emails, si se puede mostrar: una ruta propia se
 * convierte en dirección completa (el cliente de correo no conoce el sitio) y
 * un SVG se descarta porque Gmail y Outlook no lo muestran.
 */
export function storeEmailLogoUrl(logoUrl: string | null | undefined): string | undefined {
  const value = logoUrl?.trim()
  if (!value) return undefined
  const absolute = value.startsWith('/') ? siteUrl(value) : value
  if (!/^https:\/\//i.test(absolute)) return undefined
  if (/\.svg(\?|#|$)/i.test(absolute)) return undefined
  return absolute
}
