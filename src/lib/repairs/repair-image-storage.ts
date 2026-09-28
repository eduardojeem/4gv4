import type { SupabaseClient } from '@supabase/supabase-js'

export const REPAIR_IMAGE_BUCKET = 'repair-images'
export const REPAIR_IMAGE_URL_TTL_SECONDS = 300

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${REPAIR_IMAGE_BUCKET}/`
const MAX_OBJECT_PATH_LENGTH = 1024

export function repairImageUploadPrefix(organizationId: string, userId: string): string {
  return `organizations/${organizationId}/repair-images/${userId}/`
}

export function isOwnedRepairImagePath(
  value: string,
  organizationId: string,
  userId: string,
): boolean {
  const path = repairImagePath(value)
  return Boolean(path?.startsWith(repairImageUploadPrefix(organizationId, userId)))
}

function isKnownSupabaseOrigin(url: URL): boolean {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (configuredUrl) {
    try {
      if (url.origin === new URL(configuredUrl).origin) return true
    } catch {
      // An invalid server configuration must not widen the accepted URL boundary.
    }
  }

  return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')
}

function normalizeObjectPath(value: string): string | null {
  let decoded: string

  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  if (
    !decoded ||
    decoded.length > MAX_OBJECT_PATH_LENGTH ||
    decoded.startsWith('/') ||
    decoded.endsWith('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    decoded.includes('?') ||
    decoded.includes('#')
  ) {
    return null
  }

  const segments = decoded.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null
  }

  return decoded
}

export function repairImagePath(value: string): string | null {
  const candidate = value.trim()
  if (!candidate) return null

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate)
      if (!isKnownSupabaseOrigin(url) || !url.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) {
        return null
      }

      return normalizeObjectPath(url.pathname.slice(PUBLIC_OBJECT_PREFIX.length))
    } catch {
      return null
    }
  }

  if (candidate.includes('://')) return null
  return normalizeObjectPath(candidate)
}

export async function signRepairImagePath(
  admin: SupabaseClient,
  path: string,
): Promise<string | null> {
  const normalizedPath = repairImagePath(path)
  if (!normalizedPath) return null

  const { data, error } = await admin.storage
    .from(REPAIR_IMAGE_BUCKET)
    .createSignedUrl(normalizedPath, REPAIR_IMAGE_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
