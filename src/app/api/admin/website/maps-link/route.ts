import { NextResponse, type NextRequest } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { extractMapsCoordinates, isShortMapsLink, isValidGoogleMapsUrl } from '@/lib/website/company-maps-url'

export const dynamic = 'force-dynamic'

const MAX_REDIRECTS = 5

/** Solo se sigue a Google: no se usa para pedir cualquier dirección desde el servidor. */
const isGoogleHost = (hostname: string) =>
  hostname === 'maps.app.goo.gl' || hostname === 'goo.gl' || /^(?:(?:www|maps)\.)?google\.[a-z.]+$/i.test(hostname) || hostname === 'consent.google.com'

/**
 * Convierte el enlace corto que comparte la app de Maps (maps.app.goo.gl/…) en
 * el largo, que trae el lugar y las coordenadas. Con el corto el mapa de la
 * tienda solo podía ubicarse por la dirección escrita, que a veces no alcanza.
 */
async function handler(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null
  const raw = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!isShortMapsLink(raw)) {
    return NextResponse.json({ url: raw, resolved: false, coordinates: extractMapsCoordinates(raw) })
  }

  let current = raw
  try {
    for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
      const response = await fetch(current, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Mozilla/5.0' } })
      const location = response.headers.get('location')
      if (!location || response.status < 300 || response.status >= 400) break
      const next = new URL(location, current)
      if (next.protocol !== 'https:' || !isGoogleHost(next.hostname)) break
      // La pantalla de consentimiento trae el destino real en «continue».
      const target = next.hostname === 'consent.google.com' ? next.searchParams.get('continue') : null
      current = target ?? next.toString()
      if (!isShortMapsLink(current)) break
    }
  } catch {
    return NextResponse.json({ url: raw, resolved: false, coordinates: null })
  }

  const resolved = current !== raw && isValidGoogleMapsUrl(current)
  return NextResponse.json({ url: resolved ? current : raw, resolved, coordinates: resolved ? extractMapsCoordinates(current) : null })
}

export const POST = withAdminAuth(handler)
