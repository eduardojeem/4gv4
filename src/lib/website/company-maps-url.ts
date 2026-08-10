const GOOGLE_DOMAIN_PATTERN = /^(?:(?:www|maps)\.)?google\.[a-z.]+$/i

export function isValidGoogleMapsUrl(value?: string | null): boolean {
  if (!value?.trim()) return false

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return false

    const hostname = url.hostname.toLowerCase()
    if (hostname === 'maps.app.goo.gl') return true

    return GOOGLE_DOMAIN_PATTERN.test(hostname) && url.pathname.startsWith('/maps')
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
