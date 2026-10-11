const GOOGLE_DOMAIN_PATTERN = /^(?:(?:www|maps)\.)?google\.[a-z.]+$/i

export function isValidGoogleMapsUrl(value?: string | null): boolean {
  if (!value?.trim()) return false

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return false

    const hostname = url.hostname.toLowerCase()
    if (hostname === 'maps.app.goo.gl') return true
    if (hostname === 'goo.gl' && url.pathname.startsWith('/maps')) return true

    if (GOOGLE_DOMAIN_PATTERN.test(hostname)) {
      return url.pathname.startsWith('/maps') || hostname.startsWith('maps.')
    }

    return false
  } catch {
    return false
  }
}

export function getCompanyMapsHref(
  mapsUrl?: string | null,
  address?: string | null
): string | null {
  const exactUrl = mapsUrl?.trim()
  if (exactUrl && isValidGoogleMapsUrl(exactUrl)) return exactUrl

  const normalizedAddress = address?.trim()
  if (!normalizedAddress) return null

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress)}`
}

/**
 * Retorna la URL de inserción (iframe embed) de Google Maps.
 * Extrae coordenadas o términos de búsqueda si provienen de un URL de Google Maps,
 * o utiliza la dirección del local como fallback.
 */
export function getCompanyMapsEmbedSrc(
  mapsUrl?: string | null,
  address?: string | null
): string | null {
  const exactUrl = mapsUrl?.trim()
  if (exactUrl && isValidGoogleMapsUrl(exactUrl)) {
    try {
      const url = new URL(exactUrl)
      // Caso 1: URL de coordenadas directas tipo @-25.2865,-57.6432
      const coordsMatch = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (coordsMatch) {
        const [, lat, lng] = coordsMatch
        return `https://maps.google.com/maps?q=${lat},${lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`
      }
      // Caso 2: URL con place/Nombre+Del+Lugar
      const placeMatch = url.pathname.match(/\/place\/([^/@]+)/)
      if (placeMatch) {
        const placeQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        return `https://maps.google.com/maps?q=${encodeURIComponent(placeQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`
      }
      // Caso 3: Query param q en google.com/maps?q=...
      const qParam = url.searchParams.get('q') || url.searchParams.get('query')
      if (qParam) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(qParam)}&t=&z=16&ie=UTF8&iwloc=&output=embed`
      }
    } catch {
      // Ignorar error de parseo y caer en address
    }
  }

  const normalizedAddress = address?.trim()
  if (normalizedAddress) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(normalizedAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`
  }

  return null
}
