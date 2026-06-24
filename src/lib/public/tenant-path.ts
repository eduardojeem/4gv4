import { headers } from 'next/headers'
import { isTenantPublicSection } from '@/lib/saas/tenant'

export async function getPublicTenantPathPrefix() {
  const headerStore = await headers()
  const slug = headerStore.get('x-tenant-slug')

  return slug ? `/${slug}` : ''
}

export function prefixPublicTenantPath(prefix: string, href: string) {
  if (!prefix) return href
  const section = href.split(/[/?#]/)[1]
  if (!isTenantPublicSection(section)) {
    return href
  }

  return `${prefix}${href}`
}
