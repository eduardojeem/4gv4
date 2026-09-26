const PUBLIC_STORAGE_MARKER = '/storage/v1/object/public/product-images/'
const PROMOTION_FILE_PATTERN = /^[a-zA-Z0-9-]{1,220}\.(?:jpg|png|webp|avif)$/

export function getPromotionStoragePathFromUrl(value: string): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    const markerIndex = url.pathname.indexOf(PUBLIC_STORAGE_MARKER)
    if (markerIndex < 0) return null

    const path = decodeURIComponent(url.pathname.slice(markerIndex + PUBLIC_STORAGE_MARKER.length))
    if (!path.startsWith('website/promotions/') || path.includes('..') || path.includes('\\')) return null
    return path
  } catch {
    return null
  }
}

export function isOrganizationPromotionPath(path: string, organizationId: string): boolean {
  const prefix = `website/promotions/${organizationId}/`
  if (!path.startsWith(prefix) || path.includes('..') || path.includes('\\')) return false

  return PROMOTION_FILE_PATTERN.test(path.slice(prefix.length))
}
