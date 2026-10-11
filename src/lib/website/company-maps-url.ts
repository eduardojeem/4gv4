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
      // Caso 1: coordenadas. Primero el pin del lugar (!3d…!4d…), después el
      // centro de la vista (@lat,lng), que puede quedar a unas cuadras del local.
      const coords = extractMapsCoordinates(exactUrl)
      if (coords) {
        return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`
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

/** Enlaces cortos que comparte la app de Maps («Compartir»): no traen la ubicación a la vista. */
export function isShortMapsLink(value?: string | null): boolean {
  try {
    const url = new URL(String(value ?? '').trim())
    return url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps'))
  } catch {
    return false
  }
}

/** Latitud y longitud de un enlace de Google Maps, si las trae (@lat,lng · !3d…!4d… · q=lat,lng). */
export function extractMapsCoordinates(value?: string | null): { lat: number; lng: number } | null {
  const text = String(value ?? '')
  const patterns = [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  }
  return null
}

/**
 * «Cómo llegar»: abre la ruta en Google Maps hasta el local. Con coordenadas va
 * al punto exacto; si no, a la dirección; un enlace corto se abre tal cual.
 */
export function getDirectionsHref(mapsUrl?: string | null, address?: string | null): string | null {
  const exact = mapsUrl?.trim() && isValidGoogleMapsUrl(mapsUrl) ? mapsUrl.trim() : null
  const coords = extractMapsCoordinates(exact)
  if (coords) return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
  const normalizedAddress = address?.trim()
  if (normalizedAddress) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(normalizedAddress)}`
  return exact
}

/** La misma ruta en Waze, muy usado para manejar. */
export function getWazeHref(mapsUrl?: string | null, address?: string | null): string | null {
  const exact = mapsUrl?.trim() && isValidGoogleMapsUrl(mapsUrl) ? mapsUrl.trim() : null
  const coords = extractMapsCoordinates(exact)
  if (coords) return `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
  const normalizedAddress = address?.trim()
  return normalizedAddress ? `https://waze.com/ul?q=${encodeURIComponent(normalizedAddress)}&navigate=yes` : null
}
