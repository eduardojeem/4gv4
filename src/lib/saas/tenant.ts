import type { NextRequest } from 'next/server'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const TENANT_PATH_SECTIONS = new Set(['inicio', 'productos', 'mis-reparaciones', 'track', 'carrito', 'cliente'])

function stripPort(host: string) {
  return host.split(':')[0]?.toLowerCase() ?? ''
}

export function getTenantSlugFromHost(host: string, rootDomain = process.env.APP_ROOT_DOMAIN) {
  const normalizedHost = stripPort(host)

  if (!normalizedHost || LOCAL_HOSTS.has(normalizedHost) || normalizedHost.endsWith('.vercel.app')) {
    return null
  }

  if (!rootDomain) {
    const [subdomain] = normalizedHost.split('.')
    return subdomain && subdomain !== 'www' ? subdomain : null
  }

  const normalizedRoot = stripPort(rootDomain)

  if (normalizedHost === normalizedRoot || normalizedHost === `www.${normalizedRoot}`) {
    return null
  }

  if (!normalizedHost.endsWith(`.${normalizedRoot}`)) {
    return null
  }

  const slug = normalizedHost.slice(0, -(normalizedRoot.length + 1))
  return slug && slug !== 'www' ? slug : null
}

export function getTenantSlugFromRequest(request: NextRequest) {
  const explicitSlug = request.nextUrl.searchParams.get('org')

  if (explicitSlug) {
    return explicitSlug
  }

  return getTenantSlugFromHost(request.headers.get('host') ?? '') ?? getTenantSlugFromPath(request.nextUrl.pathname)
}

export function getTenantSlugFromPath(pathname: string) {
  const [maybeSlug, section] = pathname.split('/').filter(Boolean)

  if (!maybeSlug || !section || !TENANT_PATH_SECTIONS.has(section)) {
    return null
  }

  return slugifyTenantName(maybeSlug)
}

export function slugifyTenantName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
