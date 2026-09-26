import { NextResponse } from 'next/server'
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from '@/lib/platform/branding'
import { buildWebManifest } from '@/lib/pwa/manifest'

export const dynamic = 'force-dynamic'

/**
 * App instalable del marketplace (publico comprador).
 *
 * No se usa `app/manifest.ts` porque ese archivo solo admite un manifest por
 * proyecto y ya es el del comerciante. El layout del marketplace apunta a esta
 * ruta con `metadata.manifest`, que pisa al del layout raiz.
 */
export async function GET() {
  let branding = DEFAULT_PLATFORM_BRANDING

  try {
    branding = await getPlatformBranding()
  } catch {
    branding = DEFAULT_PLATFORM_BRANDING
  }

  const manifest = buildWebManifest({
    id: '/marketplace?app=marketplace',
    name: branding.marketplaceName || 'Marketplace',
    shortName: branding.marketplaceName || 'Marketplace',
    description: branding.marketplaceTagline || 'Empresas y productos',
    startUrl: '/marketplace',
    // Acotado a /marketplace: si el usuario entra al panel o a una tienda
    // concreta, se abre en el navegador y no dentro de esta app.
    scope: '/marketplace',
  })

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
