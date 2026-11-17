import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { normalizeOrder } from '@/lib/orders/helpers'
import { generateOrderReceiptHTML, orderReceiptPageSize, type OrderReceiptPaper } from '@/lib/orders/order-receipt'
import { resolveTenantEffectiveSettings } from '@/lib/organization/tenant-effective-settings'

/**
 * Comprobante imprimible de un pedido. Lo usan la web (ventana de impresión)
 * y la app (impresión del sistema, PDF o WhatsApp), con el mismo formato que
 * el comprobante de reparación: { html, paper, width, height }.
 * Solo lectura: no cambia el pedido.
 */
const querySchema = z.object({
  // `type` lo manda el componente de la app; el pedido tiene un solo comprobante.
  type: z.string().optional(),
  paper: z.enum(['configured', '58mm', '80mm', 'A4']).default('configured'),
})

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function' ? await params : params) as { id?: string } | undefined
  return resolved?.id
}

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    }
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'Formato de comprobante inválido.' }, { status: 400 })
    // Sin formato configurado para pedidos: 80 mm es el rollo más común.
    const paper: OrderReceiptPaper = parsed.data.paper === 'configured' ? '80mm' : parsed.data.paper

    const supabase = await createClient()
    const [order, org, settings, branch] = await Promise.all([
      supabase.from('customer_orders').select('*, order_items:customer_order_items(*)').eq('id', id).eq('organization_id', organization.id).maybeSingle(),
      supabase.from('organizations').select('name, logo_url').eq('id', organization.id).single(),
      supabase.from('organization_settings').select('display_name, modules, currency, timezone').eq('organization_id', organization.id).maybeSingle(),
      supabase.from('branches').select('phone, email, address, city').eq('organization_id', organization.id).eq('is_default', true).maybeSingle(),
    ])
    if (order.error) throw order.error
    if (!order.data) return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 })
    if (org.error || !org.data) return NextResponse.json({ error: 'No pudimos cargar los datos del comercio.' }, { status: 503 })

    const effective = resolveTenantEffectiveSettings({
      globalRow: {},
      orgSettings: settings.data,
      organizationName: org.data.name,
      defaultBranch: branch.data,
    })
    const html = generateOrderReceiptHTML(
      normalizeOrder(order.data),
      {
        name: effective.companyName || org.data.name,
        phone: effective.companyPhone,
        address: effective.companyAddress,
        email: effective.companyEmail,
        logo: org.data.logo_url ?? null,
      },
      paper,
      { currency: settings.data?.currency || 'PYG', timeZone: settings.data?.timezone || 'America/Asuncion' },
    )
    return NextResponse.json({ html, paper, ...orderReceiptPageSize(paper) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logger.error('Orders receipt error', { error })
    return NextResponse.json({ error: 'No pudimos preparar el comprobante. Intentá nuevamente.' }, { status: 500 })
  }
})
