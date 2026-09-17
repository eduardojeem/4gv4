import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'
import { isBotUserAgent, isStorefrontPage } from '@/lib/public/storefront-visits'
import { logger } from '@/lib/logger'

/**
 * Anota una visita a una tienda pública.
 *
 * Siempre responde 204: quien visita no tiene por qué enterarse de si el
 * contador anduvo o no, y una falla acá no puede romper la página.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Una persona navegando no ve más de 120 páginas en 10 minutos. */
const VISIT_RATE_LIMIT = 120
const VISIT_RATE_WINDOW_MS = 10 * 60 * 1000

/** Tiendas públicas confirmadas, para no consultar la base en cada página. */
const PUBLIC_CACHE_MS = 5 * 60 * 1000
const publicStorefronts = new Map<string, { isPublic: boolean; at: number }>()

const noContent = () => new NextResponse(null, { status: 204 })

async function isPublicStorefront(admin: ReturnType<typeof createAdminSupabase>, organizationId: string) {
  const cached = publicStorefronts.get(organizationId)
  if (cached && Date.now() - cached.at < PUBLIC_CACHE_MS) return cached.isPublic

  const { data } = await admin
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .eq('storefront_public', true)
    .maybeSingle()

  const isPublic = Boolean(data)
  publicStorefronts.set(organizationId, { isPublic, at: Date.now() })
  return isPublic
}

export async function POST(request: NextRequest) {
  try {
    if (isBotUserAgent(request.headers.get('user-agent'))) return noContent()

    const allowed = await rateLimiter.check(`storefront-visit:${getClientIp(request)}`, VISIT_RATE_LIMIT, VISIT_RATE_WINDOW_MS)
    if (!allowed) return noContent()

    // `sendBeacon` manda texto plano: se lee así y se interpreta a mano.
    const body = JSON.parse((await request.text()) || '{}') as Record<string, unknown>
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
    if (!UUID_PATTERN.test(organizationId) || !isStorefrontPage(body.page)) return noContent()

    const admin = createAdminSupabase()
    // Solo tiendas públicas: el id viaja en la página y cualquiera lo puede mandar.
    if (!(await isPublicStorefront(admin, organizationId))) return noContent()

    const { error } = await admin.rpc('record_storefront_visit', {
      p_organization_id: organizationId,
      p_page: body.page,
      p_new_visitor: body.newVisitor === true,
    })
    if (error) logger.warn('[storefront-visit] no se pudo anotar', { error: error.message })
  } catch (error) {
    logger.warn('[storefront-visit] pedido inválido', { error })
  }

  return noContent()
}
