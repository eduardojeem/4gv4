'use client'

import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname as getSharedTenantSlugFromPathname } from '@/lib/saas/tenant'

export function getTenantSlugFromPathname(pathname: string) {
  return getSharedTenantSlugFromPathname(pathname)
}

export function usePublicTenantPrefix() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)

  return {
    tenantSlug,
    tenantPrefix: tenantSlug ? `/${tenantSlug}` : '',
  }
}
