'use client'

import { usePathname } from 'next/navigation'

const TENANT_PUBLIC_SECTIONS = new Set([
  'inicio',
  'productos',
  'mis-reparaciones',
  'track',
  'carrito',
  'cliente',
  'perfil',
])

export function getTenantSlugFromPathname(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  return segments.length > 1 && TENANT_PUBLIC_SECTIONS.has(segments[1]) ? segments[0] : ''
}

export function usePublicTenantPrefix() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)

  return {
    tenantSlug,
    tenantPrefix: tenantSlug ? `/${tenantSlug}` : '',
  }
}
