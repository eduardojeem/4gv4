import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { normalizeOrder, sanitizeOrderSearch } from '@/lib/orders/helpers'
import { resolvePublicOrganization } from '@/lib/saas/public-tenant'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'

// 20 consultas por IP cada 10 minutos — suficiente para uso legítimo
const TRACK_RATE_LIMIT = 20
const TRACK_RATE_WINDOW_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────
  const clientIp = getClientIp(request)
  const allowed = rateLimiter.check(
    `track:${clientIp}`,
    TRACK_RATE_LIMIT,
    TRACK_RATE_WINDOW_MS
  )
  if (!allowed) {
    const retryAfter = rateLimiter.getResetTime(`track:${clientIp}`)
    return NextResponse.json(
      { success: false, error: 'Demasiadas consultas. Intenta de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const orderNumber    = sanitizeOrderSearch(searchParams.get('orderNumber') || '')
    const customerEmail  = searchParams.get('customerEmail')?.trim().toLowerCase() || ''
    const customerPhone  = sanitizeOrderSearch(searchParams.get('customerPhone') || '')

    // ── Require at least two factors ────────────────────────────────────
    // Always need the order number PLUS one contact identifier.
    // This prevents enumerating all orders by email/phone alone.
    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el número de pedido.' },
        { status: 400 }
      )
    }

    if (!customerEmail && !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Se requiere email o teléfono para verificar el pedido.' },
        { status: 400 }
      )
    }

    const supabase     = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    // Match by order number + contact (exact phone — no wildcard)
    let query = supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('organization_id', organization.id)
      .eq('order_number', orderNumber)

    if (customerEmail) {
      query = query.ilike('customer_email', customerEmail)
    } else {
      // Exact match — prevents single-digit enumeration attack
      query = query.eq('customer_phone', customerPhone)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw error

    if (!data) {
      // Deliberately vague — don't reveal whether the order exists
      return NextResponse.json(
        { success: false, error: 'No se encontró ningún pedido con esos datos.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        order: normalizeOrder(data),
        organization: {
          id:       organization.id,
          name:     organization.name,
          slug:     organization.slug,
          logo_url: organization.logo_url,
        },
      },
    })
  } catch (error) {
    logger.error('Public order tracking API error', { error })
    return NextResponse.json(
      { success: false, error: 'No se pudo consultar el pedido.' },
      { status: 500 }
    )
  }
}
