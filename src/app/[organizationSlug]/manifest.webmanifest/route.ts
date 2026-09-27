import { NextResponse } from 'next/server'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
import { buildWebManifest } from '@/lib/pwa/manifest'

export const dynamic = 'force-dynamic'

/**
 * App instalable de una tienda concreta.
 *
 * Es lo que arregla el caso multi-tenant: sin esto, un cliente que instalaba
 * desde /mi-tienda/inicio recibia el manifest de la raiz y al abrir el icono
 * caia en la app del comerciante, perdiendo por completo el contexto de tienda.
 *
 * El proxy solo inyecta `x-tenant-slug` para secciones publicas conocidas
 * (inicio, productos, ...), y `manifest.webmanifest` no es una de ellas, asi que
 * el slug se resuelve aca desde el parametro de ruta.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationSlug: string }> },
) {
  const { organizationSlug } = await params
  const organization = await resolvePublicOrganizationBySlug(organizationSlug).catch(() => null)

  if (!organization) {
    return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
  }

  const base = `/${organization.slug}`
  const manifest = buildWebManifest({
    id: `${base}?app=tienda`,
    name: organization.name,
    shortName: organization.name,
    description: `Compra en ${organization.name}`,
    startUrl: `${base}/inicio`,
    // Acotado a la tienda: el icono siempre abre en esta tienda y no en otra
    // ni en el panel.
    scope: base,
  })

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
