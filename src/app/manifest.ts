import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from '@/lib/platform/branding'
import { getTenantSlugFromHost } from '@/lib/saas/tenant'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
import { buildWebManifest } from '@/lib/pwa/manifest'

/**
 * Manifest por defecto del origen.
 *
 * Sirve dos casos:
 *
 * 1. Dominio de tienda (`mitienda.midominio.com`): ahi las rutas no llevan slug
 *    (`/inicio`, no `/mitienda/inicio`), asi que el manifest por slug nunca se
 *    pide. Sin esto, quien instalara desde el dominio de su tienda recibia la
 *    app del panel.
 * 2. Dominio principal: la app del comerciante, que abre en /dashboard porque
 *    quien instala desde el panel entra a trabajar, no a la landing.
 *
 * El marketplace y las tiendas por ruta (`/<slug>/...`) declaran el suyo en su
 * propio layout.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headerStore = await headers()
  const tenantSlug = getTenantSlugFromHost(headerStore.get('host') ?? '')

  if (tenantSlug) {
    const organization = await resolvePublicOrganizationBySlug(tenantSlug).catch(() => null)

    if (organization) {
      return buildWebManifest({
        id: '/?app=tienda',
        name: organization.name,
        shortName: organization.name,
        description: `Compra en ${organization.name}`,
        startUrl: '/inicio',
        scope: '/',
      })
    }
  }

  let branding = DEFAULT_PLATFORM_BRANDING

  try {
    branding = await getPlatformBranding()
  } catch {
    branding = DEFAULT_PLATFORM_BRANDING
  }

  return buildWebManifest({
    id: '/?app=panel',
    name: branding.platformName,
    shortName: branding.platformName,
    description: branding.seoDescription,
    startUrl: '/dashboard',
    scope: '/',
  })
}
