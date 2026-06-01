import { headers } from 'next/headers'

export async function getPublicTenantPathPrefix() {
  const headerStore = await headers()
  const slug = headerStore.get('x-tenant-slug')

  return slug ? `/${slug}` : ''
}

export function prefixPublicTenantPath(prefix: string, href: string) {
  if (!prefix) return href
  if (!['/inicio', '/productos', '/mis-reparaciones', '/track', '/carrito', '/perfil'].some((path) => href === path || href.startsWith(`${path}/`) || href.startsWith(`${path}?`) || href.startsWith(`${path}#`))) {
    return href
  }

  return `${prefix}${href}`
}
