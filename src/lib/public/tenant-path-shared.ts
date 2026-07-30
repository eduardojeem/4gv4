import { isTenantPublicSection } from '@/lib/saas/tenant'

export function prefixPublicTenantPath(prefix: string, href: string) {
  if (!prefix) return href
  const section = href.split(/[/?#]/)[1]
  if (!isTenantPublicSection(section)) {
    return href
  }

  return `${prefix}${href}`
}
