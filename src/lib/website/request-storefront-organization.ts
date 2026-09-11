import { headers } from 'next/headers'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
import { getTenantSlugFromHost } from '@/lib/saas/tenant'

/**
 * La tienda de la peticion actual, resuelta igual que `fetchWebsiteSettings`:
 * por el encabezado del middleware o por el subdominio. Devuelve null en el
 * dominio principal o si la tienda no existe o no es publica.
 */
export async function resolveRequestStorefrontOrganization() {
  try {
    const headerStore = await headers()
    const tenantSlug =
      headerStore.get('x-tenant-slug') ||
      getTenantSlugFromHost(headerStore.get('host') ?? '')
    return tenantSlug ? await resolvePublicOrganizationBySlug(tenantSlug) : null
  } catch (error) {
    console.error('[storefront] No se pudo resolver la tienda de la peticion', error)
    return null
  }
}
